import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/blogs/[slug]/runs — give a "run" (engagement upvote)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const blog = await prisma.blog.findUnique({
      where: { slug },
      select: { id: true, authorId: true },
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    // Author cannot give themselves runs
    if (blog.authorId === (session.user as { id?: string }).id) {
      return NextResponse.json({ error: "You cannot give runs to your own blog" }, { status: 403 });
    }

    // Increment runs
    const updated = await prisma.blog.update({
      where: { slug },
      data: { runs: { increment: 1 } },
      select: { runs: true },
    });

    // Update writer's totalRuns
    await prisma.writerProfile.update({
      where: { userId: blog.authorId },
      data: { totalRuns: { increment: 1 } },
    });

    return NextResponse.json({ runs: updated.runs });
  } catch (error) {
    console.error("Runs error:", error);
    return NextResponse.json({ error: "Failed to give run" }, { status: 500 });
  }
}

// GET /api/blogs/[slug]/runs — get current run count
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const blog = await prisma.blog.findUnique({
    where: { slug },
    select: { runs: true },
  });
  if (!blog) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ runs: blog.runs });
}
