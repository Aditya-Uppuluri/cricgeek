import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runScoringPipeline, calculateDNAUpdate, BADGE_DEFINITIONS, ACHIEVEMENT_DEFINITIONS } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  try {
    const { blogId } = await req.json();

    if (!blogId) {
      return NextResponse.json({ error: "blogId is required" }, { status: 400 });
    }

    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      include: { author: true },
    });

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    // Update processing status
    await prisma.blogScore.upsert({
      where: { blogId },
      create: { blogId, processingStatus: "processing" },
      update: { processingStatus: "processing" },
    });

    // Run the 7-step scoring pipeline
    const result = await runScoringPipeline(blog.content);

    // Save the blog score
    const blogScore = await prisma.blogScore.upsert({
      where: { blogId },
      create: {
        blogId,
        bqs: result.bqs,
        toneScore: result.modelScores.toneScore,
        toxicityScore: result.modelScores.toxicityScore,
        originalityScore: result.modelScores.originalityScore,
        coherenceScore: result.modelScores.coherenceScore,
        archetypeLabel: result.modelScores.archetypeLabel,
        archetypeConfidence: result.modelScores.archetypeConfidence,
        entitiesFound: result.nerResult.entities.length,
        statsFound: result.nerResult.statsFound.length,
        statsVerified: result.statsVerified,
        statAccuracy: result.statAccuracy,
        constructiveness: result.ruleEngine.constructiveness,
        evidencePresence: result.ruleEngine.evidencePresence,
        counterAcknowledge: result.ruleEngine.counterAcknowledge,
        positionClarity: result.ruleEngine.positionClarity,
        infoDensity: result.ruleEngine.infoDensity,
        repetitionPenalty: result.ruleEngine.repetitionPenalty,
        completeness: result.ruleEngine.completeness,
        wordCount: result.preProcess.wordCount,
        lexicalDiversity: result.preProcess.lexicalDiversity,
        sentenceVariety: result.preProcess.sentenceVariety,
        processingStatus: "completed",
        processingTimeMs: result.processingTimeMs,
      },
      update: {
        bqs: result.bqs,
        toneScore: result.modelScores.toneScore,
        toxicityScore: result.modelScores.toxicityScore,
        originalityScore: result.modelScores.originalityScore,
        coherenceScore: result.modelScores.coherenceScore,
        archetypeLabel: result.modelScores.archetypeLabel,
        archetypeConfidence: result.modelScores.archetypeConfidence,
        entitiesFound: result.nerResult.entities.length,
        statsFound: result.nerResult.statsFound.length,
        statsVerified: result.statsVerified,
        statAccuracy: result.statAccuracy,
        constructiveness: result.ruleEngine.constructiveness,
        evidencePresence: result.ruleEngine.evidencePresence,
        counterAcknowledge: result.ruleEngine.counterAcknowledge,
        positionClarity: result.ruleEngine.positionClarity,
        infoDensity: result.ruleEngine.infoDensity,
        repetitionPenalty: result.ruleEngine.repetitionPenalty,
        completeness: result.ruleEngine.completeness,
        wordCount: result.preProcess.wordCount,
        lexicalDiversity: result.preProcess.lexicalDiversity,
        sentenceVariety: result.preProcess.sentenceVariety,
        processingStatus: "completed",
        processingTimeMs: result.processingTimeMs,
      },
    });

    // Update or create writer profile
    const writerProfile = await prisma.writerProfile.upsert({
      where: { userId: blog.authorId },
      create: {
        userId: blog.authorId,
        averageBQS: result.bqs,
        totalBlogs: 1,
        archetype: result.modelScores.archetypeLabel,
        bestBQS: result.bqs,
      },
      update: {
        totalBlogs: { increment: 1 },
        averageBQS: result.bqs, // Will be recalculated below
        archetype: result.modelScores.archetypeLabel,
        bestBQS: Math.max(result.bqs),
        xp: { increment: Math.round(result.bqs / 2) },
      },
    });

    // Recalculate average BQS
    const allScores = await prisma.blogScore.findMany({
      where: { blog: { authorId: blog.authorId } },
      select: { bqs: true },
    });
    const avgBQS = allScores.reduce((sum, s) => sum + s.bqs, 0) / allScores.length;
    const level = Math.floor(writerProfile.xp / 100) + 1;

    await prisma.writerProfile.update({
      where: { userId: blog.authorId },
      data: { averageBQS: Math.round(avgBQS * 10) / 10, level },
    });

    // Update Writer DNA
    const currentDNA = await prisma.writerDNA.upsert({
      where: { userId: blog.authorId },
      create: { userId: blog.authorId },
      update: {},
    });
    const newDNA = calculateDNAUpdate(
      { analyst: currentDNA.analyst, storyteller: currentDNA.storyteller, critic: currentDNA.critic, reporter: currentDNA.reporter, debater: currentDNA.debater },
      result.modelScores.archetypeLabel,
      result.bqs,
    );
    await prisma.writerDNA.update({
      where: { userId: blog.authorId },
      data: newDNA,
    });

    // Check badges
    const existingBadges = await prisma.writerBadge.findMany({ where: { userId: blog.authorId } });
    const earnedBadgeIds = existingBadges.map(b => b.badge);

    // First Blood
    if (!earnedBadgeIds.includes('first_blood') && allScores.length >= 1) {
      const def = BADGE_DEFINITIONS.find(b => b.id === 'first_blood')!;
      await prisma.writerBadge.create({ data: { userId: blog.authorId, badge: def.id, title: def.title, description: def.description, tier: def.tier } });
    }

    // Five-For: 5 blogs above 80
    if (!earnedBadgeIds.includes('five_wickets')) {
      const highScores = allScores.filter(s => s.bqs >= 80).length;
      if (highScores >= 5) {
        const def = BADGE_DEFINITIONS.find(b => b.id === 'five_wickets')!;
        await prisma.writerBadge.create({ data: { userId: blog.authorId, badge: def.id, title: def.title, description: def.description, tier: def.tier } });
      }
    }

    // Check achievements
    const existingAchievements = await prisma.writerAchievement.findMany({ where: { userId: blog.authorId } });
    const earnedAchIds = existingAchievements.map(a => a.achievement);

    for (const achDef of ACHIEVEMENT_DEFINITIONS) {
      if (earnedAchIds.includes(achDef.id)) continue;
      let earned = false;
      if (achDef.id.startsWith('blogs_') && allScores.length >= achDef.milestone) earned = true;
      if (achDef.id.startsWith('bqs_') && avgBQS >= achDef.milestone) earned = true;
      if (earned) {
        await prisma.writerAchievement.create({
          data: { userId: blog.authorId, achievement: achDef.id, title: achDef.title, description: achDef.description, milestone: achDef.milestone },
        });
      }
    }

    return NextResponse.json({
      message: "Scoring completed",
      score: blogScore,
      bqs: result.bqs,
      archetype: result.modelScores.archetypeLabel,
    });
  } catch (error) {
    console.error("Scoring pipeline error:", error);
    return NextResponse.json({ error: "Scoring pipeline failed" }, { status: 500 });
  }
}
