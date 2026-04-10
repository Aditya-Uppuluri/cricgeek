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
  overs: number;
  target: number | null;
  currentRunRate: number;
  requiredRunRate: number | null;
  projectedTotal: number;
  pressureIndex: number;
  momentumIndex: number;
  phase: string;
}

export interface LiveEdaReport {
  match: Match;
  snapshot: LivePressureSnapshot;
  cards: PostMatchEdaCard[];
  summary: string;
  advisor: InsightsAdvisorResponse | null;
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
