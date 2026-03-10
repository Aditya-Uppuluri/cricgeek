import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET all approved blogs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const tag = searchParams.get("tag");

    const where: Record<string, unknown> = { status: "approved" };
    if (tag) {
      where.tags = { contains: tag };
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { comments: true } },
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
    const { title, content, tags, authorId } = await req.json();

    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: "Title, content, and authorId are required" },
        { status: 400 }
      );
    }

    // Word count validation (50-2000 words)
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 50 || wordCount > 2000) {
      return NextResponse.json(
        { error: `Blog must be 50-2000 words. Current: ${wordCount} words` },
        { status: 400 }
      );
    }

    const slug =
      title
        .toLowerCase()
        .replace(/[^\w ]+/g, "")
        .replace(/ +/g, "-") +
      "-" +
      Date.now().toString(36);

    const blog = await prisma.blog.create({
      data: {
        title,
        content,
        excerpt: content.slice(0, 150) + "...",
        slug,
        tags: tags || "",
        authorId,
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
