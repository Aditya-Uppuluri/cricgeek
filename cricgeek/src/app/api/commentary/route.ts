import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/commentary — list sessions (optionally filter by status)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // "live" | "ended" | null (all)

  const where = status ? { status } : {};

  const sessions = await prisma.liveCommentarySession.findMany({
    where,
    include: {
      moderator: { select: { id: true, name: true, avatar: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sessions });
}

// POST /api/commentary — create a new session (moderator/admin only)
export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id: string; role: string } | undefined;

  if (!user || !["moderator", "admin"].includes(user.role)) {
    return NextResponse.json(
      { error: "Only moderators and admins can start commentary sessions" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { matchId, matchName, matchType } = body;

    if (!matchId || !matchName) {
      return NextResponse.json(
        { error: "matchId and matchName are required" },
        { status: 400 }
      );
    }

    const commentarySession = await prisma.liveCommentarySession.create({
      data: {
        matchId,
        matchName,
        matchType: matchType || "T20",
        moderatorId: user.id,
        status: "live",
      },
      include: {
        moderator: { select: { id: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json({ session: commentarySession }, { status: 201 });
  } catch (error) {
    console.error("Failed to create commentary session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
