/**
 * CricGeek AI Scoring Pipeline
 *
 * Production path:
 * 1. Local pre-processing
 * 2. Qwen (via Ollama) structured sports-writing analysis
 * 3. Deterministic BQS assembly and moderation override logic
 * 4. Persisted explanation JSON + paragraph scores for user-visible breakdowns
 *
 * Fallback path:
 * - Heuristic scoring when Ollama is unavailable
 */

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_BQS_MODEL = process.env.OLLAMA_BQS_MODEL || process.env.OLLAMA_MODEL || "qwen3.5:latest";

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
  negativityScore: number;
  toxicityScore: number;
  originalityScore: number;
  coherenceScore: number;
  archetypeLabel: Archetype;
  archetypeConfidence: number;
}

export interface ParagraphScore {
  paragraphIndex: number;
  excerpt: string;
  overall: number;
  constructiveness: number;
  negativity: number;
  toxicity: number;
  evidence: number;
  coherence: number;
  note: string;
}

export interface ExplanationJson {
  summary: string;
  strengths: string[];
  concerns: string[];
  negativityVsToxicity: string;
  penaltyDecision: string;
  userVisibleBreakdown: string[];
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
  toxicityPenaltyApplied: boolean;
  toxicityPenaltyOverride: boolean;
}

export interface BlogScoreResult {
  bqs: number;
  preProcess: PreProcessResult;
  modelScores: ModelScores;
  nerResult: NERResult;
  ruleEngine: RuleEngineResult;
  paragraphScores: ParagraphScore[];
  explanation: ExplanationJson;
  statsVerified: number;
  statAccuracy: number;
  processingTimeMs: number;
  scoreVersion: string;
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

// ── Step 2-6: Call Ollama (Qwen) ───────────────────────────────────

interface OllamaScoreResponse {
  archetype: Archetype;
  archetype_confidence: number;
  tone_score: number;
  negativity_score: number;
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
  paragraph_scores?: Array<{
    paragraph_index?: number;
    excerpt?: string;
    overall?: number;
    constructiveness?: number;
    negativity?: number;
    toxicity?: number;
    evidence?: number;
    coherence?: number;
    note?: string;
  }>;
  explanation?: {
    summary?: string;
    strengths?: string[];
    concerns?: string[];
    negativity_vs_toxicity?: string;
    penalty_decision?: string;
    user_visible_breakdown?: string[];
  };
}

function clampScore(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function clampUnit(value: unknown, fallback = 0.5): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function safeStringList(value: unknown, limit = 4): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, limit)
    : [];
}

function excerptForParagraph(paragraph: string): string {
  return paragraph.replace(/\s+/g, " ").trim().slice(0, 120);
}

async function callOllamaScorer(input: { title?: string; content: string }): Promise<OllamaScoreResponse | null> {
  const paragraphs = input.content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 8);

  const prompt = `You are CricGeek's sports-writing quality analyst.
Return strict JSON only. Do not wrap in markdown.

Score this cricket article on a 0-100 scale for each dimension.
Important moderation rule:
- Strong criticism or disappointment is NEGATIVITY, not toxicity.
- Toxicity means insults, abuse, dehumanisation, slurs, harassment, or targeted hostility.
- If the article is sharp but evidence-based and constructive, keep toxicity low.

Use these archetypes only: analyst, fan, storyteller, debater.

Return JSON with exactly these keys:
{
  "archetype": "analyst|fan|storyteller|debater",
  "archetype_confidence": 0.0,
  "tone_score": 0,
  "negativity_score": 0,
  "toxicity_score": 0,
  "originality_score": 0,
  "coherence_score": 0,
  "constructiveness": 0,
  "evidence_presence": 0,
  "counter_acknowledge": 0,
  "position_clarity": 0,
  "info_density": 0,
  "repetition_penalty": 0,
  "completeness": 0,
  "argument_logic": 0,
  "stat_accuracy": 0,
  "entities_found": 0,
  "stats_found": 0,
  "stats_verified": 0,
  "word_count": 0,
  "lexical_diversity": 0,
  "sentence_variety": 0,
  "paragraph_scores": [
    {
      "paragraph_index": 0,
      "excerpt": "",
      "overall": 0,
      "constructiveness": 0,
      "negativity": 0,
      "toxicity": 0,
      "evidence": 0,
      "coherence": 0,
      "note": ""
    }
  ],
  "explanation": {
    "summary": "",
    "strengths": ["", "", ""],
    "concerns": ["", "", ""],
    "negativity_vs_toxicity": "",
    "penalty_decision": "",
    "user_visible_breakdown": ["", "", ""]
  }
}

Title: ${input.title || "Untitled"}
Paragraphs:
${paragraphs.map((paragraph, index) => `[${index}] ${paragraph}`).join("\n\n")}`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_BQS_MODEL,
        prompt,
        format: "json",
        stream: false,
        options: {
          temperature: 0.15,
          top_p: 0.85,
          num_predict: 800,
        },
      }),
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn("[scoring] Ollama scorer error:", errorText);
      return null;
    }

    const data = (await res.json()) as { response?: string };
    if (!data.response) return null;
    return JSON.parse(data.response) as OllamaScoreResponse;
  } catch {
    console.warn("[scoring] Ollama scorer unavailable — using heuristic fallback");
    return null;
  }
}

// ── Heuristic Fallback (when AI service is offline) ──────────────────

function heuristicScore(text: string, pp: PreProcessResult): OllamaScoreResponse {
  const words = text.toLowerCase().split(/\s+/);
  const wc = words.length;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const positiveTerms = ["excellent", "brilliant", "impressive", "dominant", "outstanding"];
  const negativeTerms = ["terrible", "worst", "awful", "disaster", "poor", "sloppy", "frustrating", "disappointing"];
  const toxicPatterns = ["idiot", "stupid", "trash", "garbage", "loser", "hate"];

  const posHits = words.filter((w) => positiveTerms.includes(w)).length;
  const negHits = words.filter((w) => negativeTerms.includes(w)).length;
  const toneScore = Math.min(100, Math.round(((posHits + 1) / (posHits + negHits + 2)) * 80 + 10));
  const negativityScore = Math.min(100, Math.round((negHits / Math.max(wc, 1)) * 600 + 18));
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

  return {
    archetype: bestArchetype,
    archetype_confidence: 0.5,
    tone_score: toneScore,
    negativity_score: negativityScore,
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
    paragraph_scores: paragraphs.map((paragraph, index) => ({
      paragraph_index: index,
      excerpt: excerptForParagraph(paragraph),
      overall: Math.round((constructiveness + coherenceScore + originalityScore) / 3),
      constructiveness,
      negativity: negativityScore,
      toxicity: toxicityScore,
      evidence: evidencePresence,
      coherence: coherenceScore,
      note: toxicityScore > 45 ? "Tone is getting personal." : "Mostly cricket-focused analysis.",
    })),
    explanation: {
      summary: "Fallback heuristic analysis used because Ollama was unavailable.",
      strengths: [
        originalityScore > 65 ? "Varied vocabulary adds freshness." : "Readable cricket writing structure.",
        constructiveness > 60 ? "Reasoning language improves constructiveness." : "Opinion is clear enough to follow.",
        coherenceScore > 70 ? "Overall flow remains coherent." : "Paragraph flow is serviceable.",
      ],
      concerns: [
        toxicityScore > 40 ? "Hostile wording is dragging the score down." : "Evidence could be more specific.",
        negativityScore > 55 ? "The piece leans negative in tone." : "There is room for stronger counter-points.",
        "Fallback mode has lower confidence than the Ollama path.",
      ],
      negativity_vs_toxicity:
        negativityScore > toxicityScore
          ? "The article is more critical than abusive."
          : "Negative tone and toxicity are close together here.",
      penalty_decision:
        toxicityScore > 55
          ? "A full toxicity penalty was applied."
          : "Only a light toxicity penalty was applied.",
      user_visible_breakdown: [
        `Constructiveness ${constructiveness}/100`,
        `Negativity ${negativityScore}/100`,
        `Toxicity ${toxicityScore}/100`,
      ],
    },
  };
}

function countVerifiedStats(text: string) {
  const matches = text.match(/\b\d+(\.\d+)?\b/g) ?? [];
  const cricketTerms = ["average", "strike rate", "economy", "runs", "wickets", "overs", "balls"];
  const statsFound = matches.length;
  const contextHits = cricketTerms.filter((term) => text.toLowerCase().includes(term)).length;
  const statsVerified = Math.min(statsFound, Math.round(statsFound * 0.65 + contextHits * 0.35));
  const statAccuracy = statsFound === 0 ? 75 : Math.min(100, Math.round((statsVerified / statsFound) * 100));

  return { statsFound, statsVerified, statAccuracy };
}

function normaliseParagraphScores(
  value: OllamaScoreResponse["paragraph_scores"],
  paragraphs: string[],
  fallbackScores: ReturnType<typeof heuristicScore>
): ParagraphScore[] {
  const fallback = fallbackScores.paragraph_scores ?? [];

  return paragraphs.map((paragraph, index) => {
    const source = value?.find((entry) => entry.paragraph_index === index) ?? fallback[index];

    return {
      paragraphIndex: index,
      excerpt: typeof source?.excerpt === "string" && source.excerpt.trim().length > 0
        ? source.excerpt.trim().slice(0, 120)
        : excerptForParagraph(paragraph),
      overall: clampScore(source?.overall, 60),
      constructiveness: clampScore(source?.constructiveness, 55),
      negativity: clampScore(source?.negativity, 30),
      toxicity: clampScore(source?.toxicity, 8),
      evidence: clampScore(source?.evidence, 40),
      coherence: clampScore(source?.coherence, 60),
      note: typeof source?.note === "string" && source.note.trim().length > 0
        ? source.note.trim().slice(0, 160)
        : "Paragraph-level read generated from the scoring engine.",
    };
  });
}

function buildExplanation(
  model: ModelScores,
  ruleEngine: Omit<RuleEngineResult, "toxicityPenaltyApplied" | "toxicityPenaltyOverride">,
  moderation: { penaltyApplied: boolean; overrideApplied: boolean },
  aiExplanation: OllamaScoreResponse["explanation"] | undefined
): ExplanationJson {
  const defaultBreakdown = [
    `Constructiveness ${Math.round(ruleEngine.constructiveness)}/100`,
    `Negativity ${Math.round(model.negativityScore)}/100`,
    `Toxicity ${Math.round(model.toxicityScore)}/100`,
  ];

  return {
    summary:
      aiExplanation?.summary?.trim() ||
      "This score weighs clarity, evidence, constructiveness, originality, and safe discourse.",
    strengths:
      safeStringList(aiExplanation?.strengths, 4).length > 0
        ? safeStringList(aiExplanation?.strengths, 4)
        : [
            ruleEngine.constructiveness >= 70 ? "Constructive reasoning supports the argument." : "The stance is understandable.",
            model.coherenceScore >= 70 ? "The writing stays coherent from paragraph to paragraph." : "The article keeps a usable flow.",
            model.originalityScore >= 70 ? "The phrasing feels distinct rather than boilerplate." : "There is at least some original framing.",
          ],
    concerns:
      safeStringList(aiExplanation?.concerns, 4).length > 0
        ? safeStringList(aiExplanation?.concerns, 4)
        : [
            model.toxicityScore >= 45 ? "The wording moves toward personal hostility." : "Some claims could use stronger support.",
            model.negativityScore >= 60 ? "The tone is strongly negative, even if not fully toxic." : "Counter-arguments are underdeveloped.",
            ruleEngine.evidencePresence < 55 ? "Evidence density is lower than ideal for a top score." : "There is still room for sharper proof points.",
          ],
    negativityVsToxicity:
      aiExplanation?.negativity_vs_toxicity?.trim() ||
      (model.negativityScore > model.toxicityScore
        ? "The system detected critical or frustrated language, but that is not automatically treated as toxicity."
        : "The system saw negative language that overlaps with abusive phrasing, so toxicity was weighted more heavily."),
    penaltyDecision:
      aiExplanation?.penalty_decision?.trim() ||
      (moderation.overrideApplied
        ? "A reduced toxicity penalty was used because the piece stayed constructive and evidence-led."
        : moderation.penaltyApplied
          ? "A toxicity penalty was applied because hostile language outweighed the article's constructive value."
          : "No heavy toxicity penalty was needed because negativity remained within acceptable debate."),
    userVisibleBreakdown:
      safeStringList(aiExplanation?.user_visible_breakdown, 5).length > 0
        ? safeStringList(aiExplanation?.user_visible_breakdown, 5)
        : defaultBreakdown,
  };
}

function resolveModerationPenalty(model: ModelScores, ruleEngine: Omit<RuleEngineResult, "toxicityPenaltyApplied" | "toxicityPenaltyOverride">) {
  const clearToxicity = model.toxicityScore >= 65;
  const borderlineToxicity = model.toxicityScore >= 25 && model.toxicityScore < 65;
  const overrideApplied =
    borderlineToxicity &&
    model.negativityScore >= model.toxicityScore &&
    ruleEngine.constructiveness >= 68 &&
    ruleEngine.evidencePresence >= 58 &&
    ruleEngine.counterAcknowledge >= 35;

  const effectiveToxicity = overrideApplied
    ? model.toxicityScore * 0.35
    : model.toxicityScore;
  const penaltyApplied = clearToxicity || model.toxicityScore >= 28;

  return {
    effectiveToxicity,
    penaltyApplied,
    overrideApplied,
  };
}

function computeBQS(
  model: ModelScores,
  ruleEngine: Omit<RuleEngineResult, "toxicityPenaltyApplied" | "toxicityPenaltyOverride">,
  statAccuracy: number,
  archetype: Archetype
) {
  const weights = ARCHETYPE_WEIGHTS[archetype];
  const moderation = resolveModerationPenalty(model, ruleEngine);
  const toxicityInv = 100 - moderation.effectiveToxicity;
  const negativityAdjustment = model.negativityScore > 70 && model.toxicityScore < 20 ? 4 : 0;

  let score =
    ruleEngine.constructiveness * weights.constructiveness +
    toxicityInv * weights.toxicityInv +
    model.originalityScore * weights.originalityScore +
    statAccuracy * weights.statAccuracy +
    ruleEngine.infoDensity * weights.infoDensity +
    model.coherenceScore * weights.coherenceScore +
    ruleEngine.argumentLogic * weights.argumentLogic;

  score += ruleEngine.evidencePresence * 0.05;
  score += ruleEngine.positionClarity * 0.05;
  score -= ruleEngine.repetitionPenalty * 0.04;
  score += negativityAdjustment;

  if (!moderation.overrideApplied && model.toxicityScore >= 70) {
    score -= 12;
  } else if (!moderation.overrideApplied && model.toxicityScore >= 45) {
    score -= 6;
  }

  return {
    bqs: Math.max(0, Math.min(100, Math.round(score))),
    moderation,
  };
}

// ── Full Pipeline ────────────────────────────────────────────────────

export async function runScoringPipeline(input: string | { title?: string; content: string }): Promise<BlogScoreResult> {
  const started = Date.now();
  const payload = typeof input === "string" ? { content: input } : input;
  const text = payload.content;

  // Step 1: Pre-process (always local)
  const pp = preProcess(text);
  const statMetrics = countVerifiedStats(text);
  const fallback = heuristicScore(text, pp);

  // Steps 2–7: Try Ollama, fall back to heuristics
  const aiResult = await callOllamaScorer(payload);
  const r = aiResult ?? fallback;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const modelScores: ModelScores = {
    toneScore: clampScore(r.tone_score, fallback.tone_score),
    negativityScore: clampScore(r.negativity_score, fallback.negativity_score),
    toxicityScore: clampScore(r.toxicity_score, fallback.toxicity_score),
    originalityScore: clampScore(r.originality_score, fallback.originality_score),
    coherenceScore: clampScore(r.coherence_score, fallback.coherence_score),
    archetypeLabel: (["analyst", "fan", "storyteller", "debater"].includes(r.archetype)
      ? r.archetype
      : fallback.archetype) as Archetype,
    archetypeConfidence: clampUnit(r.archetype_confidence, fallback.archetype_confidence),
  };

  const ruleEngineBase = {
    constructiveness: clampScore(r.constructiveness, fallback.constructiveness),
    evidencePresence: clampScore(r.evidence_presence, fallback.evidence_presence),
    counterAcknowledge: clampScore(r.counter_acknowledge, fallback.counter_acknowledge),
    positionClarity: clampScore(r.position_clarity, fallback.position_clarity),
    infoDensity: clampScore(r.info_density, fallback.info_density),
    repetitionPenalty: clampScore(r.repetition_penalty, fallback.repetition_penalty),
    completeness: clampScore(Math.max(r.completeness || 0, pp.completeness), Math.max(fallback.completeness, pp.completeness)),
    argumentLogic: clampScore(r.argument_logic, fallback.argument_logic),
  };

  const { bqs, moderation } = computeBQS(
    modelScores,
    ruleEngineBase,
    clampScore(r.stat_accuracy, statMetrics.statAccuracy),
    modelScores.archetypeLabel
  );

  const paragraphScores = normaliseParagraphScores(r.paragraph_scores, paragraphs, fallback);
  const explanation = buildExplanation(modelScores, ruleEngineBase, moderation, r.explanation);

  return {
    bqs,
    preProcess: {
      wordCount: pp.wordCount,
      sentenceCount: pp.sentenceCount,
      paragraphCount: pp.paragraphCount,
      lexicalDiversity: pp.lexicalDiversity,
      sentenceVariety: pp.sentenceVariety,
      avgSentenceLength: pp.avgSentenceLength,
      completeness: r.completeness,
    },
    modelScores,
    nerResult: {
      entities: [],
      statsFound: [],
      cricketDepth: ruleEngineBase.infoDensity,
    },
    ruleEngine: {
      ...ruleEngineBase,
      toxicityPenaltyApplied: moderation.penaltyApplied,
      toxicityPenaltyOverride: moderation.overrideApplied,
    },
    paragraphScores,
    explanation,
    statsVerified: Math.max(statMetrics.statsVerified, r.stats_verified ?? 0),
    statAccuracy: Math.max(clampScore(r.stat_accuracy, statMetrics.statAccuracy), statMetrics.statAccuracy),
    processingTimeMs: Date.now() - started,
    scoreVersion: "qwen3.5-v1",
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
