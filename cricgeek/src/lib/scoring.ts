/**
 * CricGeek AI Scoring Pipeline
 * 
 * 7-step blog quality analysis:
 * 1. Pre-processing (lexical diversity, sentence variety, completeness)
 * 2. Model scoring (simulated — RoBERTa, Toxic-BERT, MiniLM, BART-MNLI)
 * 3. NER entity extraction (simulated — BERT-NER)
 * 4. Stat validation (Sportmonks API placeholder)
 * 5. Rule engine (constructiveness, evidence, position clarity)
 * 6. Archetype decision + weight table
 * 7. BQS assembly
 */

// ── Types ───────────────────────────────────────────────────────────

export interface PreProcessResult {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  lexicalDiversity: number;    // unique words / total words (0-1)
  sentenceVariety: number;     // std dev of sentence lengths (0-100 normalized)
  avgSentenceLength: number;
  completeness: number;        // has intro + body + conclusion signal (0-100)
}

export interface ModelScores {
  toneScore: number;           // RoBERTa sentiment → constructiveness (0-100)
  toxicityScore: number;       // Toxic-BERT (0-100, lower is better)
  originalityScore: number;    // MiniLM embedding uniqueness (0-100)
  coherenceScore: number;      // MiniLM paragraph flow (0-100)
  archetypeLabel: string;      // BART-MNLI zero-shot classification
  archetypeConfidence: number; // 0-1
}

export interface NERResult {
  entities: { name: string; type: string; }[];
  statsFound: { player: string; stat: string; value: string; }[];
  cricketDepth: number;        // 0-100 based on cricket-specific terms
}

export interface RuleEngineResult {
  constructiveness: number;    // (0-100)
  evidencePresence: number;    // (0-100)
  counterAcknowledge: number;  // (0-100)
  positionClarity: number;     // (0-100)
  infoDensity: number;         // (0-100)
  repetitionPenalty: number;   // (0-100, higher=less repetition)
  completeness: number;        // (0-100)
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

// Archetype weight tables — different archetypes value different qualities
const ARCHETYPE_WEIGHTS: Record<string, Record<string, number>> = {
  analyst: {
    toneScore: 0.08, toxicityPenalty: 0.05, originalityScore: 0.12,
    coherenceScore: 0.15, constructiveness: 0.10, evidencePresence: 0.20,
    counterAcknowledge: 0.05, positionClarity: 0.10, infoDensity: 0.10,
    statAccuracy: 0.05,
  },
  storyteller: {
    toneScore: 0.15, toxicityPenalty: 0.05, originalityScore: 0.20,
    coherenceScore: 0.20, constructiveness: 0.05, evidencePresence: 0.05,
    counterAcknowledge: 0.05, positionClarity: 0.10, infoDensity: 0.05,
    statAccuracy: 0.10,
  },
  critic: {
    toneScore: 0.10, toxicityPenalty: 0.10, originalityScore: 0.10,
    coherenceScore: 0.10, constructiveness: 0.15, evidencePresence: 0.10,
    counterAcknowledge: 0.15, positionClarity: 0.10, infoDensity: 0.05,
    statAccuracy: 0.05,
  },
  reporter: {
    toneScore: 0.05, toxicityPenalty: 0.05, originalityScore: 0.10,
    coherenceScore: 0.15, constructiveness: 0.10, evidencePresence: 0.15,
    counterAcknowledge: 0.05, positionClarity: 0.10, infoDensity: 0.15,
    statAccuracy: 0.10,
  },
  debater: {
    toneScore: 0.10, toxicityPenalty: 0.10, originalityScore: 0.10,
    coherenceScore: 0.10, constructiveness: 0.10, evidencePresence: 0.10,
    counterAcknowledge: 0.15, positionClarity: 0.15, infoDensity: 0.05,
    statAccuracy: 0.05,
  },
  rookie: {
    toneScore: 0.10, toxicityPenalty: 0.10, originalityScore: 0.10,
    coherenceScore: 0.10, constructiveness: 0.10, evidencePresence: 0.10,
    counterAcknowledge: 0.10, positionClarity: 0.10, infoDensity: 0.10,
    statAccuracy: 0.10,
  },
};

// ── Step 1: Pre-processing ──────────────────────────────────────────

export function preProcess(text: string): PreProcessResult {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = Math.max(paragraphs.length, 1);

  // Lexical diversity: unique words / total words
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;

  // Sentence variety: normalized std dev of sentence lengths
  const sentLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(sentLengths.length, 1);
  const variance = sentLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) / Math.max(sentLengths.length, 1);
  const stdDev = Math.sqrt(variance);
  const sentenceVariety = Math.min(100, stdDev * 10); // normalize

  // Completeness: check for intro + body + conclusion signals
  let completeness = 0;
  if (paragraphCount >= 3) completeness += 40;
  else if (paragraphCount >= 2) completeness += 20;
  if (sentenceCount >= 5) completeness += 30;
  if (wordCount >= 120) completeness += 30;

  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    lexicalDiversity,
    sentenceVariety,
    avgSentenceLength: avgLen,
    completeness: Math.min(100, completeness),
  };
}

// ── Step 2: Model Scoring (Simulated) ───────────────────────────────

export function simulateModelScores(text: string): ModelScores {
  // Simulated model outputs — replace with HuggingFace/Oracle API calls
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  
  // Tone: positive cricket analysis terms boost score
  const positiveTerms = ['excellent', 'brilliant', 'impressive', 'dominant', 'outstanding', 'remarkable', 'incredible', 'masterclass'];
  const negativeTerms = ['terrible', 'worst', 'awful', 'disaster', 'pathetic', 'hopeless', 'useless'];
  const posHits = words.filter(w => positiveTerms.includes(w)).length;
  const negHits = words.filter(w => negativeTerms.includes(w)).length;
  const toneRatio = (posHits + 1) / (posHits + negHits + 2);
  const toneScore = Math.min(100, Math.round(toneRatio * 80 + Math.random() * 20));

  // Toxicity: check for abusive patterns
  const toxicPatterns = ['hate', 'stupid', 'idiot', 'trash', 'garbage', 'loser', 'suck'];
  const toxicHits = words.filter(w => toxicPatterns.some(p => w.includes(p))).length;
  const toxicityScore = Math.min(100, Math.round((toxicHits / Math.max(wordCount, 1)) * 500 + Math.random() * 5));

  // Originality: based on lexical diversity + unique phrases
  const uniqueWords = new Set(words);
  const originalityScore = Math.min(100, Math.round((uniqueWords.size / Math.max(wordCount, 1)) * 120 + Math.random() * 10));

  // Coherence: based on sentence-to-sentence flow (simplified)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  let coherence = 70;
  if (sentences.length >= 3) coherence += 10;
  if (sentences.length >= 5) coherence += 10;
  const coherenceScore = Math.min(100, coherence + Math.round(Math.random() * 10));

  // Archetype classification via keyword analysis
  const archetypes = [
    { label: 'analyst', keywords: ['average', 'stats', 'data', 'numbers', 'records', 'comparison', 'rate', 'percentage', 'economy', 'strike rate'] },
    { label: 'storyteller', keywords: ['remember', 'moment', 'journey', 'story', 'memory', 'atmosphere', 'feeling', 'emotion', 'watched'] },
    { label: 'critic', keywords: ['however', 'but', 'although', 'despite', 'weakness', 'flaw', 'issue', 'problem', 'concern', 'overrated'] },
    { label: 'reporter', keywords: ['match', 'score', 'wicket', 'runs', 'overs', 'result', 'won', 'lost', 'series', 'tournament'] },
    { label: 'debater', keywords: ['argue', 'because', 'therefore', 'opinion', 'believe', 'better', 'worse', 'versus', 'vs', 'debate'] },
  ];
  
  const archetypeScores = archetypes.map(a => ({
    label: a.label,
    count: words.filter(w => a.keywords.includes(w)).length,
  }));
  archetypeScores.sort((a, b) => b.count - a.count);
  const bestArchetype = archetypeScores[0];
  const totalKeywordHits = archetypeScores.reduce((s, a) => s + a.count, 0);

  return {
    toneScore,
    toxicityScore,
    originalityScore,
    coherenceScore,
    archetypeLabel: bestArchetype.count > 0 ? bestArchetype.label : 'rookie',
    archetypeConfidence: totalKeywordHits > 0 ? bestArchetype.count / totalKeywordHits : 0,
  };
}

// ── Step 3: NER Entity Extraction (Simulated) ───────────────────────

export function extractEntities(text: string): NERResult {
  // Simulated BERT-NER — detect cricket player names and stats
  const knownPlayers = [
    'Virat Kohli', 'Rohit Sharma', 'Jasprit Bumrah', 'MS Dhoni', 'Sachin Tendulkar',
    'Kane Williamson', 'Steve Smith', 'Joe Root', 'Ben Stokes', 'Pat Cummins',
    'Rashid Khan', 'Babar Azam', 'Kagiso Rabada', 'Mitchell Starc', 'Ravindra Jadeja',
    'KL Rahul', 'Shubman Gill', 'Rishabh Pant', 'Hardik Pandya', 'Suryakumar Yadav',
  ];

  const entities: { name: string; type: string }[] = [];
  const statsFound: { player: string; stat: string; value: string }[] = [];

  // Find player mentions
  for (const player of knownPlayers) {
    if (text.toLowerCase().includes(player.toLowerCase())) {
      entities.push({ name: player, type: 'PLAYER' });
    }
  }

  // Find stat-like patterns (e.g., "average of 58.18", "strike rate 139.4")
  const statPatterns = [
    /(?:average|avg)[\s:]+(\d+\.?\d*)/gi,
    /(?:strike rate|sr)[\s:]+(\d+\.?\d*)/gi,
    /(?:economy|econ)[\s:]+(\d+\.?\d*)/gi,
    /(\d+)\s*(?:wickets?|wkts?)/gi,
    /(\d+)\s*(?:runs?|centuries?|100s?|50s?)/gi,
  ];

  for (const pattern of statPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      statsFound.push({
        player: entities[0]?.name || 'Unknown',
        stat: match[0],
        value: match[1],
      });
    }
  }

  // Cricket depth: cricket-specific terms
  const cricketTerms = [
    'wicket', 'bowling', 'batting', 'innings', 'over', 'boundary', 'six', 'four',
    'captain', 'opener', 'spinner', 'pace', 'seam', 'swing', 'yorker', 'bouncer',
    'lbw', 'caught', 'stumped', 'run out', 'test match', 'odi', 't20', 'ipl',
    'world cup', 'ashes', 'pitch', 'crease', 'pavilion', 'duck', 'century',
  ];
  const lowerText = text.toLowerCase();
  const termHits = cricketTerms.filter(t => lowerText.includes(t)).length;
  const cricketDepth = Math.min(100, Math.round((termHits / 10) * 100));

  return { entities, statsFound, cricketDepth };
}

// ── Step 5: Rule Engine ─────────────────────────────────────────────

export function ruleEngine(text: string, entities: NERResult): RuleEngineResult {
  const words = text.toLowerCase().split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = words.length;

  // Constructiveness: reasoning words + constructive language
  const reasoningWords = ['because', 'therefore', 'however', 'although', 'since', 'thus', 'hence', 'suggests', 'indicates', 'evidence'];
  const reasoningHits = words.filter(w => reasoningWords.includes(w)).length;
  const constructiveness = Math.min(100, Math.round((reasoningHits / Math.max(1, wordCount)) * 800 + 30));

  // Evidence presence: stats, names, specific references
  const evidenceSignals = entities.entities.length * 15 + entities.statsFound.length * 20;
  const evidencePresence = Math.min(100, evidenceSignals + 20);

  // Counter acknowledgement: "but", "however", "on the other hand", "although"
  const counterWords = ['but', 'however', 'although', 'nevertheless', 'conversely', 'contrary', 'despite', 'yet'];
  const counterHits = words.filter(w => counterWords.includes(w)).length;
  const counterAcknowledge = Math.min(100, counterHits * 25 + 10);

  // Position clarity: clear statement words
  const positionWords = ['believe', 'think', 'opinion', 'argue', 'suggest', 'clearly', 'undoubtedly', 'best', 'worst', 'should'];
  const positionHits = words.filter(w => positionWords.includes(w)).length;
  const positionClarity = Math.min(100, positionHits * 20 + 20);

  // Information density: unique information per sentence
  const avgWordsPerSentence = wordCount / Math.max(sentences.length, 1);
  const infoDensity = Math.min(100, Math.round(avgWordsPerSentence * 5 + entities.cricketDepth * 0.3));

  // Repetition penalty: detect repeated phrases
  const phrases = [];
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(words.slice(i, i + 3).join(' '));
  }
  const uniquePhrases = new Set(phrases);
  const repetitionRatio = phrases.length > 0 ? uniquePhrases.size / phrases.length : 1;
  const repetitionPenalty = Math.round(repetitionRatio * 100);

  // Completeness: structural completeness
  const hasIntro = sentences.length >= 2;
  const hasBody = sentences.length >= 4;
  const hasConclusion = sentences.length >= 5;
  const completeness = (hasIntro ? 33 : 0) + (hasBody ? 34 : 0) + (hasConclusion ? 33 : 0);

  return {
    constructiveness,
    evidencePresence,
    counterAcknowledge,
    positionClarity,
    infoDensity,
    repetitionPenalty,
    completeness,
  };
}

// ── Step 6-7: Archetype Decision & BQS Assembly ─────────────────────

export function assembleScore(
  preProcessResult: PreProcessResult,
  modelScores: ModelScores,
  nerResult: NERResult,
  ruleEngineResult: RuleEngineResult,
  statsVerified: number = 0,
  totalStats: number = 0,
): BlogScoreResult {
  const startTime = Date.now();
  const archetype = modelScores.archetypeLabel || 'rookie';
  const weights = ARCHETYPE_WEIGHTS[archetype] || ARCHETYPE_WEIGHTS.rookie;

  const statAccuracy = totalStats > 0 ? (statsVerified / totalStats) * 100 : 75; // default 75 if no stats

  // Assemble BQS from weighted components
  const components: Record<string, number> = {
    toneScore: modelScores.toneScore,
    toxicityPenalty: 100 - modelScores.toxicityScore, // invert: low toxicity = high score
    originalityScore: modelScores.originalityScore,
    coherenceScore: modelScores.coherenceScore,
    constructiveness: ruleEngineResult.constructiveness,
    evidencePresence: ruleEngineResult.evidencePresence,
    counterAcknowledge: ruleEngineResult.counterAcknowledge,
    positionClarity: ruleEngineResult.positionClarity,
    infoDensity: ruleEngineResult.infoDensity,
    statAccuracy,
  };

  let bqs = 0;
  for (const [key, weight] of Object.entries(weights)) {
    bqs += (components[key] || 0) * weight;
  }

  // Apply bonuses/penalties
  if (preProcessResult.lexicalDiversity > 0.7) bqs += 3;
  if (preProcessResult.sentenceVariety > 40) bqs += 2;
  if (ruleEngineResult.repetitionPenalty < 50) bqs -= 5;
  if (modelScores.toxicityScore > 50) bqs -= 10;

  bqs = Math.max(0, Math.min(100, Math.round(bqs)));

  return {
    bqs,
    preProcess: preProcessResult,
    modelScores,
    nerResult,
    ruleEngine: ruleEngineResult,
    statsVerified,
    statAccuracy,
    processingTimeMs: Date.now() - startTime,
  };
}

// ── Full Pipeline ───────────────────────────────────────────────────

export async function runScoringPipeline(text: string): Promise<BlogScoreResult> {
  // Step 1: Pre-processing
  const preProcessResult = preProcess(text);

  // Step 2: Model scoring (parallel in production)
  const modelScores = simulateModelScores(text);

  // Step 3: NER extraction
  const nerResult = extractEntities(text);

  // Step 4: Stat validation (placeholder — would call Sportmonks)
  const statsVerified = nerResult.statsFound.length; // assume all verified for now

  // Step 5: Rule engine
  const ruleEngineResult = ruleEngine(text, nerResult);

  // Step 6-7: Assemble
  const result = assembleScore(
    preProcessResult,
    modelScores,
    nerResult,
    ruleEngineResult,
    statsVerified,
    nerResult.statsFound.length,
  );

  return result;
}

// ── Writer DNA Update ───────────────────────────────────────────────

export function calculateDNAUpdate(
  currentDNA: { analyst: number; storyteller: number; critic: number; reporter: number; debater: number },
  archetype: string,
  bqs: number,
): { analyst: number; storyteller: number; critic: number; reporter: number; debater: number } {
  // 80/20 moving average: 80% existing + 20% new signal
  const boost = bqs / 100; // 0-1
  const decay = 0.8;
  const growth = 0.2;

  const newDNA = { ...currentDNA };
  const archetypeKey = archetype as keyof typeof newDNA;

  for (const key of Object.keys(newDNA) as (keyof typeof newDNA)[]) {
    if (key === archetypeKey) {
      // Boost the matching archetype
      newDNA[key] = Math.min(100, Math.round(newDNA[key] * decay + boost * 100 * growth));
    } else {
      // Slight decay for non-matching
      newDNA[key] = Math.max(0, Math.round(newDNA[key] * 0.95));
    }
  }

  return newDNA;
}

// ── Badge Definitions ───────────────────────────────────────────────

export const BADGE_DEFINITIONS = [
  { id: 'first_blood', title: 'First Blood', description: 'Published your first blog', tier: 'bronze', icon: '🏏' },
  { id: 'century_maker', title: 'Century Maker', description: 'Score 100 BQS on a blog', tier: 'gold', icon: '💯' },
  { id: 'stat_master', title: 'Stat Master', description: '10+ verified stats across blogs', tier: 'silver', icon: '📊' },
  { id: 'fact_checker', title: 'Fact Checker', description: '100% stat accuracy on 5 blogs', tier: 'silver', icon: '✅' },
  { id: 'clean_player', title: 'Clean Player', description: '10 blogs with 0 toxicity', tier: 'bronze', icon: '🧤' },
  { id: 'five_wickets', title: 'Five-For', description: '5 blogs with BQS above 80', tier: 'silver', icon: '⭐' },
  { id: 'double_century', title: 'Double Century', description: '200+ total views', tier: 'gold', icon: '🏆' },
  { id: 'all_rounder', title: 'All-Rounder', description: 'All DNA scores above 60', tier: 'platinum', icon: '🌟' },
  { id: 'consistent', title: 'Mr. Consistent', description: '4-week blogging streak', tier: 'silver', icon: '🔥' },
  { id: 'viral', title: 'Gone Viral', description: 'Single blog crosses 500 views', tier: 'gold', icon: '🚀' },
];

export const ACHIEVEMENT_DEFINITIONS = [
  { id: 'blogs_1', title: 'Opening Over', description: 'Published 1 blog', milestone: 1 },
  { id: 'blogs_5', title: 'Building Momentum', description: 'Published 5 blogs', milestone: 5 },
  { id: 'blogs_10', title: 'Set in the Crease', description: 'Published 10 blogs', milestone: 10 },
  { id: 'blogs_25', title: 'Quarter Century', description: 'Published 25 blogs', milestone: 25 },
  { id: 'blogs_50', title: 'Half Century', description: 'Published 50 blogs', milestone: 50 },
  { id: 'views_100', title: 'Crowd Gathering', description: 'Total 100 views', milestone: 100 },
  { id: 'views_500', title: 'Full House', description: 'Total 500 views', milestone: 500 },
  { id: 'views_1000', title: 'Stadium Roar', description: 'Total 1000 views', milestone: 1000 },
  { id: 'bqs_70', title: 'Quality Innings', description: 'Average BQS above 70', milestone: 70 },
  { id: 'bqs_90', title: 'Match Winner', description: 'Average BQS above 90', milestone: 90 },
];
