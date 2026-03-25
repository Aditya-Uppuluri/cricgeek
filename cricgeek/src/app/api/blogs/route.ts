import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { screenSubmittedWriting } from "@/lib/content-moderation";
import { slugify } from "@/lib/utils";

// GET all approved blogs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const tag = searchParams.get("tag");

    const archetype = searchParams.get("archetype");

    const where: Record<string, unknown> = { status: "approved" };
    if (tag) {
      where.tags = { contains: tag };
    }
    if (archetype && ["analyst", "fan", "storyteller", "debater"].includes(archetype)) {
      where.score = { archetypeLabel: archetype };
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          excerpt: true,
          slug: true,
          tags: true,
          views: true,
          runs: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { comments: true } },
          score: { select: { bqs: true, archetypeLabel: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blog.count({ where }),
    ]);

    return NextResponse.json({
      blogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Blog fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch blogs" },
      { status: 500 }
    );
  }
}

// POST new blog
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as { id: string } | undefined;
    const { title, content, tags } = await req.json();

    if (!user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to publish a blog" },
        { status: 401 }
      );
    }

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const cleanTitle = String(title).trim();
    const cleanContent = String(content).trim();
    const cleanTags = String(tags || "").trim();

    // Word count validation (50-2000 words)
    const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;
    if (wordCount < 50 || wordCount > 2000) {
      return NextResponse.json(
        { error: `Blog must be 50-2000 words. Current: ${wordCount} words` },
        { status: 400 }
      );
    }

    const moderation = screenSubmittedWriting({
      title: cleanTitle,
      content: cleanContent,
      tags: cleanTags,
    });

    if (!moderation.allowed) {
      return NextResponse.json(
        { error: moderation.reason || "This submission did not pass moderation." },
        { status: 422 }
      );
    }

    const slug = `${slugify(cleanTitle)}-${Date.now().toString(36)}`;

    const blog = await prisma.blog.create({
      data: {
        title: cleanTitle,
        content: cleanContent,
        excerpt: `${cleanContent.slice(0, 150).trim()}...`,
        slug,
        tags: cleanTags,
        authorId: user.id,
        status: "approved", // Auto-approve for now; enable moderation later
      },
    });

    return NextResponse.json(
      { message: "Blog submitted for review", blog },
      { status: 201 }
    );
  } catch (error) {
    console.error("Blog creation error:", error);
    return NextResponse.json(
      { error: "Failed to create blog" },
      { status: 500 }
    );
  }
}
