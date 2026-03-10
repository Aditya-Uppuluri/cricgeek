import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        createdAt: true,
        writerProfile: true,
        writerDNA: true,
        badges: {
          orderBy: { earnedAt: "desc" },
        },
        achievements: {
          orderBy: { earnedAt: "desc" },
        },
        blogs: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            slug: true,
            views: true,
            createdAt: true,
            score: {
              select: { bqs: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Writer not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      createdAt: user.createdAt,
      profile: user.writerProfile || {
        averageBQS: 0, totalBlogs: 0, totalViews: 0, archetype: "rookie",
        level: 1, xp: 0, bestBQS: 0, featuredCount: 0, streak: 0, bcs: 0,
      },
      dna: user.writerDNA || {
        analyst: 50, storyteller: 50, critic: 50, reporter: 50, debater: 50,
      },
      badges: user.badges,
      achievements: user.achievements,
      recentBlogs: user.blogs,
    });
  } catch (error) {
    console.error("Writer fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch writer" }, { status: 500 });
  }
}
