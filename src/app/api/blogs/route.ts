import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { screenSubmittedWriting } from "@/lib/content-moderation";
import { extractMentionSignals, getPersonalizationScore } from "@/lib/personalization";
import { canPublishBlogs } from "@/lib/roles";
import { slugify } from "@/lib/utils";
import { resolveContestStatus } from "@/lib/contest";

// GET all approved blogs
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const viewerId = (session?.user as { id?: string } | undefined)?.id;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const tag = searchParams.get("tag");
    const matchId = searchParams.get("matchId");
    const archetype = searchParams.get("archetype");
    const feed = searchParams.get("feed") || "latest";

    const where: Record<string, unknown> = { status: "approved" };
    if (tag) {
      where.tags = { contains: tag };
    }
    if (matchId) {
      where.matchTag = matchId;
    }
    if (archetype && ["analyst", "fan", "storyteller", "debater"].includes(archetype)) {
      where.score = { archetypeLabel: archetype };
    }

    const viewerStateSelect = viewerId
      ? {
          reactions: {
            where: { userId: viewerId },
            select: { id: true },
            take: 1,
          },
          saves: {
            where: { userId: viewerId },
            select: { id: true },
            take: 1,
          },
        }
      : {};

    let followedWriterIds = new Set<string>();
    let preferences:
      | {
          favoriteTags?: unknown;
          favoriteTeams?: unknown;
          favoritePlayers?: unknown;
        }
      | null = null;

    if (viewerId && (feed === "following" || feed === "for-you")) {
      const [follows, feedPreferences] = await Promise.all([
        prisma.writerFollow.findMany({
          where: { followerId: viewerId },
          select: { writerId: true },
        }),
        feed === "for-you"
          ? prisma.userFeedPreference.findUnique({
              where: { userId: viewerId },
              select: {
                favoriteTags: true,
                favoriteTeams: true,
                favoritePlayers: true,
              },
            })
          : Promise.resolve(null),
      ]);

      followedWriterIds = new Set(follows.map((follow) => follow.writerId));
      preferences = feedPreferences;
    }

    if (feed === "saved" && !viewerId) {
      return NextResponse.json({
        blogs: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    if (feed === "saved" && viewerId) {
      where.saves = { some: { userId: viewerId } };
    }

    if (feed === "following") {
      if (!viewerId || followedWriterIds.size === 0) {
        return NextResponse.json({
          blogs: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }

      where.authorId = { in: [...followedWriterIds] };
    }

    const queryTake = feed === "for-you" ? Math.max(limit * 4, 24) : limit;
    const querySkip = feed === "for-you" ? 0 : (page - 1) * limit;

    const [rawBlogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          excerpt: true,
          slug: true,
          tags: true,
          matchTag: true,
          views: true,
          runs: true,
          createdAt: true,
          mentionedPlayers: true,
          mentionedTeams: true,
          authorId: true,
          author: { select: { id: true, name: true, avatar: true, role: true } },
          _count: { select: { comments: true, reactions: true, saves: true } },
          score: { select: { bqs: true, archetypeLabel: true } },
          ...viewerStateSelect,
        },
        orderBy: { createdAt: "desc" },
        skip: querySkip,
        take: queryTake,
      }),
      prisma.blog.count({ where }),
    ]);

    const rankedBlogs =
      feed === "for-you" && viewerId
        ? [...rawBlogs].sort((left, right) => {
            const leftScore = getPersonalizationScore({
              blog: left,
              followedWriterIds,
              preferences,
            });
            const rightScore = getPersonalizationScore({
              blog: right,
              followedWriterIds,
              preferences,
            });

            if (rightScore !== leftScore) return rightScore - leftScore;
            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
          })
        : rawBlogs;

    const paginatedBlogs =
      feed === "for-you"
        ? rankedBlogs.slice((page - 1) * limit, page * limit)
        : rankedBlogs;

    const blogs = paginatedBlogs.map((blog) => ({
      ...blog,
      viewerState: {
        reacted: "reactions" in blog ? blog.reactions.length > 0 : false,
        saved: "saves" in blog ? blog.saves.length > 0 : false,
      },
      reactionCount: blog._count.reactions,
      saveCount: blog._count.saves,
    }));

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
    const user = session?.user as { id: string; role?: string } | undefined;
    const { title, content, tags, matchId, contestId } = await req.json();

    if (!user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to publish a blog" },
        { status: 401 }
      );
    }

    if (!canPublishBlogs(user.role)) {
      return NextResponse.json(
        { error: "Upgrade to a writer profile before publishing blogs." },
        { status: 403 }
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
    const cleanMatchId =
      typeof matchId === "string" && matchId.trim().length > 0 ? matchId.trim() : null;
    const cleanContestId =
      typeof contestId === "string" && contestId.trim().length > 0 ? contestId.trim() : null;

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
    const mentionSignals = extractMentionSignals({
      title: cleanTitle,
      content: cleanContent,
      tags: cleanTags,
    });

    let contest = null;

    if (cleanContestId) {
      contest = await prisma.contest.findUnique({
        where: { id: cleanContestId },
      });

      if (!contest) {
        return NextResponse.json({ error: "Contest not found" }, { status: 404 });
      }

      if (resolveContestStatus(contest) !== "active") {
        return NextResponse.json({ error: "This contest is not accepting submissions right now." }, { status: 400 });
      }

      if (wordCount > contest.shortBlogMaxWords) {
        return NextResponse.json(
          {
            error: `Contest entries must be ${contest.shortBlogMaxWords} words or fewer. Current: ${wordCount} words`,
          },
          { status: 400 }
        );
      }

      const existingSubmission = await prisma.contestSubmission.findFirst({
        where: {
          contestId: contest.id,
          authorId: user.id,
        },
        select: { id: true },
      });

      if (existingSubmission) {
        return NextResponse.json(
          { error: "You have already submitted a short blog to this contest." },
          { status: 409 }
        );
      }
    }

    const blog = await prisma.blog.create({
      data: {
        title: cleanTitle,
        content: cleanContent,
        excerpt: `${cleanContent.slice(0, 150).trim()}...`,
        slug,
        tags: cleanTags,
        matchTag: cleanMatchId,
        mentionedPlayers: mentionSignals.mentionedPlayers,
        mentionedTeams: mentionSignals.mentionedTeams,
        authorId: user.id,
        status: "approved", // Auto-approve for now; enable moderation later
      },
    });

    if (contest) {
      await prisma.contestSubmission.create({
        data: {
          contestId: contest.id,
          blogId: blog.id,
          authorId: user.id,
        },
      });
    }

    return NextResponse.json(
      { message: contest ? "Contest entry submitted" : "Blog submitted for review", blog, contestId: contest?.id ?? null },
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
