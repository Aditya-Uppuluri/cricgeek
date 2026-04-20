import type { CricketNewsArticle } from "@/lib/news/types";
import type { Match, PostMatchEdaCard, PostMatchIntel, Squad } from "@/types/cricket";
import type { InsightsAdvisorResponse } from "@/types/insights";

export type EdaConfidenceLabel = "high" | "medium" | "low";
export type EdaSourceType =
  | "sportmonks"
  | "historical_warehouse"
  | "news"
  | "blog"
  | "rag"
  | "llm"
  | "application";

export interface EdaSourceReference {
  id: string;
  type: EdaSourceType;
  title: string;
  note: string;
  url?: string | null;
  updatedAt?: string | null;
}

export interface EdaFreshness {
  generatedAt: string;
  matchState: "scheduled" | "live" | "completed" | "unknown";
  historicalAvailable: boolean;
  newsUpdatedAt?: string | null;
  notes: string[];
}

export interface EdaConfidence {
  score: number;
  label: EdaConfidenceLabel;
  reasons: string[];
}

export interface HistoricalTeamFormSnapshot {
  team: string;
  available: boolean;
  sampleSize: number;
  wins: number;
  losses: number;
  noResult: number;
  avgRuns: number | null;
  recentRecord: string[];
  summary: string;
}

export interface HistoricalHeadToHeadSnapshot {
  available: boolean;
  teamA: string;
  teamB: string;
  sampleSize: number;
  teamAWins: number;
  teamBWins: number;
  noResult: number;
  recentEdge: string;
  summary: string;
}

export interface HistoricalVenueSnapshot {
  venue: string;
  available: boolean;
  sampleSize: number;
  avgFirstInningsScore: number | null;
  chaseWinPct: number | null;
  summary: string;
}

export interface HistoricalPlayerTrend {
  name: string;
  team: string;
  sampleSize: number;
  battingRuns: number;
  wickets: number;
  battingAverage: number | null;
  strikeRate: number | null;
  summary: string;
}

export interface PreMatchEdaReport {
  match: Match;
  squads: Squad[] | null;
  summary: string;
  cards: PostMatchEdaCard[];
  keyQuestions: string[];
  tacticalAngles: string[];
  watchPlayers: string[];
  predictedPressurePhase: string;
  historical: {
    teamForms: HistoricalTeamFormSnapshot[];
    headToHead: HistoricalHeadToHeadSnapshot;
    venue: HistoricalVenueSnapshot;
    playerTrends: HistoricalPlayerTrend[];
  };
  relatedNews: CricketNewsArticle[];
  confidence: EdaConfidence;
  freshness: EdaFreshness;
  sources: EdaSourceReference[];
}

export interface LivePressureSnapshot {
  innings: number;
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  wicketsInHand: number;
  overs: number;
  target: number | null;
  currentRunRate: number;
  requiredRunRate: number | null;
  projectedTotal: number;
  ballsRemaining: number | null;
  pressureIndex: number;
  momentumIndex: number;
  phase: string;
}

export interface LiveTimelinePoint {
  id: string;
  label: string;
  over: number;
  ball: number;
  value: number;
  secondaryValue?: number | null;
  note: string;
  isWicket?: boolean;
}

export interface LiveBarDatum {
  label: string;
  value: number;
  note: string;
}

export interface LiveImpactDatum {
  label: string;
  actual: number;
  expected: number;
  delta: number;
  sample: number;
  note: string;
}

export interface LivePartnershipDatum {
  label: string;
  pair: string;
  runs: number;
  balls: number;
  influence: number;
  note: string;
}

export interface LiveScenarioDatum {
  label: string;
  projectedTotal: number;
  winProbability: number;
  note: string;
}

export interface LiveHeatmapCell {
  over: number;
  ball: number;
  runs: number;
  pressure: number;
  label: string;
  isDot: boolean;
  isWicket: boolean;
}

export interface LiveMatchupCell {
  batter: string;
  bowler: string;
  runs: number;
  balls: number;
  dismissals: number;
  dotPct: number;
  strikeRate: number;
  threat: number;
}

export interface LiveBoundaryPressureSummary {
  recentOversLabel: string;
  recentBoundaryBalls: number;
  recentFours: number;
  recentSixes: number;
  recentBoundaryRuns: number;
  recentBoundaryRate: number;
  recentBoundaryRunShare: number;
  inningsBoundaryRate: number;
  expectedBoundaryRate: number;
  forecastBoundaryRate: number;
  pressureIndex: number;
  note: string;
}

export interface LiveAnalyticsBundle {
  ballWinProbability: LiveTimelinePoint[];
  matchControlSwing: LiveTimelinePoint[];
  pressureTimeline: LiveTimelinePoint[];
  topTurningBalls: LiveBarDatum[];
  topTurningOvers: LiveBarDatum[];
  batterImpact: LiveImpactDatum[];
  bowlerImpact: LiveImpactDatum[];
  bowlerRunsSaved: LiveImpactDatum[];
  partnershipInfluence: LivePartnershipDatum[];
  counterfactuals: LiveScenarioDatum[];
  requiredVsActualRate: LiveTimelinePoint[];
  dotBallHeatmap: LiveHeatmapCell[];
  matchupMatrix: LiveMatchupCell[];
  boundaryPressure: LiveBoundaryPressureSummary | null;
  /** DLS resource percentage remaining for the batting side */
  resourcePct: number;
  /** Entropy-weighted momentum score 0-100 (50 = neutral) */
  entropyMomentum: number;
  /** Probability (0-100) of 2+ wickets falling in the next 3 overs */
  wicketCascadeRisk: number;
  /** Death-over run forecast */
  deathOverForecast: {
    projectedDeathRuns: number;
    confidence: number;
  } | null;
  /** Win probability details from the Bayesian engine */
  winProbabilityDetail: {
    probability: number;
    ci95: [number, number];
    resourcePct: number;
    expectedRunsRemaining: number;
    featureContributions: Record<string, number>;
    priorSampleSize: number;
  } | null;
}

export interface LiveEdaReport {
  match: Match;
  snapshot: LivePressureSnapshot;
  cards: PostMatchEdaCard[];
  summary: string;
  advisor: InsightsAdvisorResponse | null;
  pollIntervalSeconds: number;
  ballsTracked: number;
  analytics: LiveAnalyticsBundle;
  confidence: EdaConfidence;
  freshness: EdaFreshness;
  warnings: string[];
  sources: EdaSourceReference[];
}

export interface PostMatchEdaReport {
  match: Match;
  intel: PostMatchIntel;
  benchmarkCards: PostMatchEdaCard[];
  historical: {
    winnerForm?: HistoricalTeamFormSnapshot | null;
    loserForm?: HistoricalTeamFormSnapshot | null;
    venue: HistoricalVenueSnapshot;
    headToHead: HistoricalHeadToHeadSnapshot;
  };
  confidence: EdaConfidence;
  freshness: EdaFreshness;
  sources: EdaSourceReference[];
}

export interface EdaAskRequest {
  question: string;
  matchId?: string | null;
  team?: string | null;
  tournament?: string | null;
}

export type EdaAskRoute =
  | "structured_only"
  | "structured_plus_rag"
  | "structured_plus_news"
  | "hybrid"
  | "news_only"
  | "rag_only";

export interface EdaAskResponse {
  answer: string;
  route: EdaAskRoute;
  confidence: EdaConfidence;
  freshness: EdaFreshness;
  citations: EdaSourceReference[];
  contextPreview: string[];
}
