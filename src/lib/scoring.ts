/**
 * CricGeek AI Scoring Pipeline
 *
 * Calls the Python AI microservice for real HuggingFace model scoring.
 * Falls back to heuristic scoring if the service is unavailable.
 *
 * Pipeline steps (mirrored from PDF spec):
 * 1. Pre-processing (lexical diversity, sentence variety, completeness)
 * 2. BART-MNLI archetype classification (Fan/Analyst/Storyteller/Debater)
 * 3. RoBERTa tone → constructiveness score
 * 4. Toxic-BERT toxicity score
 * 5. MiniLM coherence + originality via sentence embeddings
 * 6. NER entity extraction + stat accuracy
 * 7. Rule engine + BQS assembly with archetype-specific weights
 */

// ── AI Service URL ───────────────────────────────────────────────────
const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────

export type Archetype = "analyst" | "fan" | "storyteller" | "debater";

export interface PreProcessResult {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  lexicalDiversity: number;
  sentenceVariety: number;
  avgSentenceLength: number;
  completeness: number;
}

export interface ModelScores {
  toneScore: number;
  toxicityScore: number;
  originalityScore: number;
  coherenceScore: number;
  archetypeLabel: Archetype;
  archetypeConfidence: number;
}

export interface NERResult {
  entities: { name: string; type: string }[];
  statsFound: { player: string; stat: string; value: string }[];
  cricketDepth: number;
}

export interface RuleEngineResult {
  constructiveness: number;
  evidencePresence: number;
  counterAcknowledge: number;
  positionClarity: number;
  infoDensity: number;
  repetitionPenalty: number;
  completeness: number;
  argumentLogic: number;
}

export interface BlogScoreResult {
  bqs: number;
  preProcess: PreProcessResult;
  modelScores: ModelScores;
  nerResult: NERResult;
  ruleEngine: RuleEngineResult;
  statsVerified: number;
  statAccuracy: number;
  processingTimeMs: number;
}

// ── Archetype Weight Tables (PDF spec) ──────────────────────────────
const ARCHETYPE_WEIGHTS: Record<Archetype, Record<string, number>> = {
  fan: {
    constructiveness: 0.25,
    toxicityInv: 0.15,
    originalityScore: 0.15,
    statAccuracy: 0.15,
    infoDensity: 0.10,
    coherenceScore: 0.10,
    argumentLogic: 0.10,
  },
  analyst: {
    constructiveness: 0.25,
    toxicityInv: 0.15,
    originalityScore: 0.10,
    statAccuracy: 0.25,
    infoDensity: 0.15,
    coherenceScore: 0.10,
    argumentLogic: 0.00,
  },
  storyteller: {
    constructiveness: 0.20,
    toxicityInv: 0.15,
    originalityScore: 0.20,
    statAccuracy: 0.00,
    infoDensity: 0.10,
    coherenceScore: 0.20,
    argumentLogic: 0.15,
  },
  debater: {
    constructiveness: 0.20,
    toxicityInv: 0.15,
    originalityScore: 0.10,
    statAccuracy: 0.10,
    infoDensity: 0.15,
    coherenceScore: 0.15,
    argumentLogic: 0.15,
  },
};

// ── Archetype badge display configs ─────────────────────────────────
export const ARCHETYPE_META: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  analyst:     { label: "Analyst",     icon: "📊", color: "text-blue-400",   bgColor: "bg-blue-500/20" },
  fan:         { label: "Fan",         icon: "🔥", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  storyteller: { label: "Storyteller", icon: "📖", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  debater:     { label: "Debater",     icon: "⚔️",  color: "text-red-400",    bgColor: "bg-red-500/20" },
};

// ── Step 1: Pre-processing (TypeScript — always runs locally) ────────

export function preProcess(text: string): PreProcessResult {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphCount = Math.max(paragraphs.length, 1);

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const lexicalDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;

  const sentLengths = sentences.map((s) => s.trim().split(/\s+/).length);
  const avgLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(sentLengths.length, 1);
  const variance =
    sentLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) /
    Math.max(sentLengths.length, 1);
  const sentenceVariety = Math.min(100, Math.sqrt(variance) * 8);

  let completeness = 0;
  if (paragraphCount >= 3) completeness += 40;
  else if (paragraphCount >= 2) completeness += 20;
  if (sentenceCount >= 5) completeness += 30;
  if (wordCount >= 120) completeness += 30;

  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    lexicalDiversity: Math.round(lexicalDiversity * 1000) / 1000,
    sentenceVariety: Math.round(sentenceVariety * 10) / 10,
    avgSentenceLength: Math.round(avgLen * 10) / 10,
    completeness: Math.min(100, completeness),
  };
}

// ── Step 2-6: Call Python AI service ────────────────────────────────

interface AIServiceResponse {
  archetype: Archetype;
  archetype_confidence: number;
  tone_score: number;
  toxicity_score: number;
  originality_score: number;
  coherence_score: number;
  constructiveness: number;
  evidence_presence: number;
  counter_acknowledge: number;
  position_clarity: number;
  info_density: number;
  repetition_penalty: number;
  completeness: number;
  argument_logic: number;
  stat_accuracy: number;
  entities_found: number;
  stats_found: number;
  stats_verified: number;
  word_count: number;
  lexical_diversity: number;
  sentence_variety: number;
  bqs: number;
}

async function callAIService(text: string): Promise<AIServiceResponse | null> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });
    if (!res.ok) return null;
    return res.json() as Promise<AIServiceResponse>;
  } catch {
    console.warn("[scoring] AI service unavailable — using heuristic fallback");
    return null;
  }
}

// ── Heuristic Fallback (when AI service is offline) ──────────────────

function heuristicScore(text: string, pp: PreProcessResult): AIServiceResponse {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length;

  const positiveTerms = ["excellent", "brilliant", "impressive", "dominant", "outstanding"];
  const negativeTerms = ["terrible", "worst", "awful", "disaster", "pathetic"];
  const toxicPatterns = ["idiot", "stupid", "trash", "garbage", "loser", "hate"];

  const posHits = words.filter((w) => positiveTerms.includes(w)).length;
  const negHits = words.filter((w) => negativeTerms.includes(w)).length;
  const toneScore = Math.min(100, Math.round(((posHits + 1) / (posHits + negHits + 2)) * 80 + 10));
  const toxicHits = words.filter((w) => toxicPatterns.some((p) => w.includes(p))).length;
  const toxicityScore = Math.min(100, Math.round((toxicHits / Math.max(wc, 1)) * 400 + 2));

  const uniqueW = new Set(words);
  const originalityScore = Math.min(100, Math.round((uniqueW.size / Math.max(wc, 1)) * 120));
  const coherenceScore = Math.min(100, 65 + Math.round(Math.min(wc / 30, 25)));

  const archetypeKeywords: Record<Archetype, string[]> = {
    analyst: ["average", "stats", "data", "numbers", "records", "rate", "percentage", "economy"],
    fan: ["love", "passion", "excited", "amazing", "brilliant", "cheer", "support", "proud"],
    storyteller: ["remember", "moment", "journey", "story", "memory", "felt", "watched", "atmosphere"],
    debater: ["argue", "because", "therefore", "opinion", "believe", "better", "versus", "debate"],
  };
  const archetypeScores = Object.entries(archetypeKeywords).map(([label, kws]) => ({
    label: label as Archetype,
    count: words.filter((w) => kws.includes(w)).length,
  }));
  archetypeScores.sort((a, b) => b.count - a.count);
  const bestArchetype = archetypeScores[0].count > 0 ? archetypeScores[0].label : "fan";

  const reasoningWords = ["because", "therefore", "however", "since", "suggests", "evidence"];
  const reasoningHits = words.filter((w) => reasoningWords.includes(w)).length;
  const constructiveness = Math.min(100, reasoningHits * 10 + 35);
  const argumentLogic = Math.min(100, reasoningHits * 12 + 30);
  const infoDensity = Math.min(100, Math.round((wc / Math.max(pp.sentenceCount, 1)) * 4));
  const evidencePresence = Math.min(100, 20 + Math.random() * 30);

  const bqs = Math.min(
    100,
    Math.round(
      toneScore * 0.2 +
      (100 - toxicityScore) * 0.15 +
      originalityScore * 0.15 +
      coherenceScore * 0.15 +
      constructiveness * 0.2 +
      argumentLogic * 0.15
    )
  );

  return {
    archetype: bestArchetype,
    archetype_confidence: 0.5,
    tone_score: toneScore,
    toxicity_score: toxicityScore,
    originality_score: originalityScore,
    coherence_score: coherenceScore,
    constructiveness,
    evidence_presence: evidencePresence,
    counter_acknowledge: 30,
    position_clarity: 50,
    info_density: infoDensity,
    repetition_penalty: 80,
    completeness: pp.completeness,
    argument_logic: argumentLogic,
    stat_accuracy: 75,
    entities_found: 0,
    stats_found: 0,
    stats_verified: 0,
    word_count: pp.wordCount,
    lexical_diversity: pp.lexicalDiversity,
    sentence_variety: pp.sentenceVariety,
    bqs,
  };
}

// ── Full Pipeline ────────────────────────────────────────────────────

export async function runScoringPipeline(text: string): Promise<BlogScoreResult> {
  const started = Date.now();

  // Step 1: Pre-process (always local)
  const pp = preProcess(text);

  // Steps 2–7: Try AI service, fall back to heuristics
  const aiResult = await callAIService(text);
  const r = aiResult ?? heuristicScore(text, pp);

  return {
    bqs: r.bqs,
    preProcess: {
      wordCount: pp.wordCount,
      sentenceCount: pp.sentenceCount,
      paragraphCount: pp.paragraphCount,
      lexicalDiversity: pp.lexicalDiversity,
      sentenceVariety: pp.sentenceVariety,
      avgSentenceLength: pp.avgSentenceLength,
      completeness: r.completeness,
    },
    modelScores: {
      toneScore: r.tone_score,
      toxicityScore: r.toxicity_score,
      originalityScore: r.originality_score,
      coherenceScore: r.coherence_score,
      archetypeLabel: r.archetype,
      archetypeConfidence: r.archetype_confidence,
    },
    nerResult: {
      entities: [],
      statsFound: [],
      cricketDepth: r.info_density,
    },
    ruleEngine: {
      constructiveness: r.constructiveness,
      evidencePresence: r.evidence_presence,
      counterAcknowledge: r.counter_acknowledge,
      positionClarity: r.position_clarity,
      infoDensity: r.info_density,
      repetitionPenalty: r.repetition_penalty,
      completeness: r.completeness,
      argumentLogic: r.argument_logic,
    },
    statsVerified: r.stats_verified,
    statAccuracy: r.stat_accuracy,
    processingTimeMs: Date.now() - started,
  };
}

// ── Writer DNA Update (80/20 EMA, 4 archetypes) ──────────────────────

export interface WriterDNA {
  analyst: number;
  fan: number;
  storyteller: number;
  debater: number;
}

export function calculateDNAUpdate(
  currentDNA: WriterDNA,
  archetype: string,
  bqs: number,
): WriterDNA {
  const boost = bqs / 100;  // 0-1
  const decay = 0.80;
  const growth = 0.20;
  const nonMatchDecay = 0.95;

  const newDNA = { ...currentDNA };
  const archetypeKey = archetype as keyof WriterDNA;

  for (const key of Object.keys(newDNA) as (keyof WriterDNA)[]) {
    if (key === archetypeKey) {
      newDNA[key] = Math.min(100, Math.round(newDNA[key] * decay + boost * 100 * growth));
    } else {
      newDNA[key] = Math.max(0, Math.round(newDNA[key] * nonMatchDecay));
    }
  }

  return newDNA;
}

// ── Writer Title Derivation ──────────────────────────────────────────

export function calculateWriterTitle(dna: WriterDNA): string {
  const total = dna.analyst + dna.fan + dna.storyteller + dna.debater;
  if (total === 0) return "THE ROOKIE";

  const pct = {
    analyst:     dna.analyst / total,
    fan:         dna.fan / total,
    storyteller: dna.storyteller / total,
    debater:     dna.debater / total,
  };

  const dominant = Object.entries(pct).sort((a, b) => b[1] - a[1])[0];
  if (dominant[1] >= 0.50) {
    const map: Record<string, string> = {
      analyst:     "THE ANALYST",
      fan:         "THE HEARTBEAT",
      storyteller: "THE NARRATOR",
      debater:     "THE DEBATER",
    };
    return map[dominant[0]] ?? "THE WRITER";
  }
  return "THE ALL-ROUNDER";
}

// ── BCS Formula ─────────────────────────────────────────────────────

export function calculateBCS(
  avgBQS: number,
  depthScore: number,         // avg info_density
  communityScore: number,     // normalized runs/views ratio (0-100)
  consistencyScore: number,   // streak-based (0-100)
  statAccuracyBonus: number,  // avg stat accuracy (0-100)
): number {
  const bcs =
    avgBQS * 0.50 +
    depthScore * 0.20 +
    communityScore * 0.15 +
    consistencyScore * 0.10 +
    statAccuracyBonus * 0.05;
  return Math.min(100, Math.max(0, Math.round(bcs * 10) / 10));
}

// ── Badge Definitions (BCS-tier system from PDF) ─────────────────────

export const BADGE_DEFINITIONS = [
  {
    id: "bronze_scribe",
    title: "Bronze Scribe",
    description: "Published your first blog",
    tier: "bronze",
    icon: "🥉",
    minBlogs: 1,
    minBQS: 0,
  },
  {
    id: "silver_analyst",
    title: "Silver Analyst",
    description: "5+ blogs with avg BQS above 55",
    tier: "silver",
    icon: "🥈",
    minBlogs: 5,
    minBQS: 55,
  },
  {
    id: "gold_correspondent",
    title: "Gold Correspondent",
    description: "10+ blogs, avg BQS > 70, stat accuracy > 75%",
    tier: "gold",
    icon: "🥇",
    minBlogs: 10,
    minBQS: 70,
    minStatAccuracy: 75,
  },
  {
    id: "diamond_expert",
    title: "Diamond Expert",
    description: "20+ blogs, avg BQS > 80, stat accuracy > 85%",
    tier: "diamond",
    icon: "💎",
    minBlogs: 20,
    minBQS: 80,
    minStatAccuracy: 85,
  },
  {
    id: "cg_verified_analyst",
    title: "CricGeek Verified Analyst",
    description: "Elite writer — manually reviewed",
    tier: "verified",
    icon: "✒️",
    minBlogs: 30,
    minBQS: 90,
    minStatAccuracy: 90,
  },
  // Legacy cricket-flavoured badges (kept from original)
  {
    id: "first_blood",
    title: "First Blood",
    description: "Published your first blog",
    tier: "bronze",
    icon: "🏏",
    minBlogs: 1,
    minBQS: 0,
  },
  {
    id: "five_wickets",
    title: "Five-For",
    description: "5 blogs with BQS above 80",
    tier: "silver",
    icon: "⭐",
    minBlogs: 5,
    minBQS: 80,
  },
  {
    id: "century_maker",
    title: "Century Maker",
    description: "Score 100 BQS on a blog",
    tier: "gold",
    icon: "💯",
    minBlogs: 1,
    minBQS: 100,
  },
  {
    id: "clean_player",
    title: "Clean Player",
    description: "10 blogs with 0 toxicity",
    tier: "bronze",
    icon: "🧤",
    minBlogs: 10,
    minBQS: 0,
  },
  {
    id: "stat_master",
    title: "Stat Master",
    description: "10+ verified stats across blogs",
    tier: "silver",
    icon: "📊",
    minBlogs: 3,
    minBQS: 0,
  },
  {
    id: "all_rounder",
    title: "All-Rounder",
    description: "All DNA scores above 20%",
    tier: "gold",
    icon: "🌟",
    minBlogs: 15,
    minBQS: 0,
  },
  {
    id: "viral",
    title: "Gone Viral",
    description: "Single blog crosses 1,000 views",
    tier: "gold",
    icon: "🚀",
    minBlogs: 1,
    minBQS: 0,
  },
  {
    id: "mr_consistent",
    title: "Mr. Consistent",
    description: "4-week blogging streak",
    tier: "silver",
    icon: "🔥",
    minBlogs: 4,
    minBQS: 0,
  },
];

// ── Achievement Definitions ──────────────────────────────────────────

export const ACHIEVEMENT_DEFINITIONS = [
  { id: "blogs_1",   title: "Opening Over",        description: "Published 1 blog",   milestone: 1 },
  { id: "blogs_5",   title: "Building Momentum",   description: "Published 5 blogs",  milestone: 5 },
  { id: "blogs_10",  title: "Set in the Crease",   description: "Published 10 blogs", milestone: 10 },
  { id: "blogs_25",  title: "Quarter Century",     description: "Published 25 blogs", milestone: 25 },
  { id: "blogs_50",  title: "Half Century",        description: "Published 50 blogs", milestone: 50 },
  { id: "views_100", title: "Crowd Gathering",     description: "100 total views",    milestone: 100 },
  { id: "views_1000",title: "Stadium Roar",        description: "1,000 total views",  milestone: 1000 },
  { id: "views_10k", title: "💎 VIRAL",            description: "10,000 total views", milestone: 10000 },
  { id: "runs_100",  title: "Century of Runs",     description: "100 total runs",     milestone: 100 },
  { id: "bqs_70",   title: "Quality Innings",      description: "Avg BQS above 70",   milestone: 70 },
  { id: "bqs_90",   title: "Match Winner",         description: "Avg BQS above 90",   milestone: 90 },
];

// ── DNA Achievement Definitions ──────────────────────────────────────

export const DNA_ACHIEVEMENT_DEFINITIONS = [
  {
    id: "dna_pure_analyst",
    title: "Pure Blood Analyst",
    description: "Analyst DNA dominates across 10+ blogs",
    archetype: "analyst",
    threshold: 50,
    minBlogs: 10,
  },
  {
    id: "dna_voice_of_fans",
    title: "Voice of the Fans",
    description: "Fan DNA dominates across 10+ blogs",
    archetype: "fan",
    threshold: 50,
    minBlogs: 10,
  },
  {
    id: "dna_chronicler",
    title: "The Chronicler",
    description: "Storyteller DNA dominates across 8+ blogs",
    archetype: "storyteller",
    threshold: 40,
    minBlogs: 8,
  },
  {
    id: "dna_contrarian",
    title: "The Contrarian",
    description: "Debater DNA dominates across 8+ blogs",
    archetype: "debater",
    threshold: 40,
    minBlogs: 8,
  },
  {
    id: "dna_all_rounder",
    title: "True All-Rounder",
    description: "No single archetype below 15% across 15+ blogs",
    archetype: "all",
    threshold: 15,
    minBlogs: 15,
  },
];

// ── View Count Milestone Messages ────────────────────────────────────

export const VIEW_MILESTONES: Array<{ views: number; message: string }> = [
  { views: 100,   message: "🎉 Century! 100 readers" },
  { views: 1000,  message: "🏏 Your blog hit 1,000 views!" },
  { views: 10000, message: "💎 VIRAL — 10,000 readers — Featured on homepage" },
];
