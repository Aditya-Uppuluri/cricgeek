import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { publish } from "@/lib/commentary-pubsub";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// GET /api/commentary/[sessionId]/entries — paginated entries
export async function GET(request: Request, { params }: RouteParams) {
  const { sessionId } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const entries = await prisma.liveCommentaryEntry.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {}),
  });

  return NextResponse.json({
    entries,
    nextCursor: entries.length === limit ? entries[entries.length - 1]?.id : null,
  });
}

// POST /api/commentary/[sessionId]/entries — add a new entry
export async function POST(request: Request, { params }: RouteParams) {
  const { sessionId } = await params;
  const authSession = await auth();
  const user = authSession?.user as { id: string; role: string } | undefined;

  if (!user || !["moderator", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Verify the session exists and is live
  const session = await prisma.liveCommentarySession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "live") {
    return NextResponse.json(
      { error: "Session is not live. Cannot add entries." },
      { status: 400 }
    );
  }

  // Only the session moderator or admins can add entries
  if (session.moderatorId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Not your session" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { text, overText, source } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const entry = await prisma.liveCommentaryEntry.create({
      data: {
        sessionId,
        text: text.trim(),
        overText: overText || null,
        source: source === "voice" ? "voice" : "typed",
      },
    });

    // Publish to SSE subscribers
    publish(sessionId, {
      id: entry.id,
      sessionId: entry.sessionId,
      text: entry.text,
      overText: entry.overText,
      source: entry.source,
      createdAt: entry.createdAt.toISOString(),
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create entry:", error);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}
