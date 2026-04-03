export interface InsightsMetadata {
  teams: string[];
  teamsByGender: {
    male: string[];
    female: string[];
  };
  players: string[];
  playerMatches: string[];
  playerCount: number;
  teamCount: number;
  genderCounts: {
    male: number;
    female: number;
  };
  artifactStatus: {
    aggregatedRows: number;
    filteredRows: number;
    bowlingRows: number;
    bayesAvailable: boolean;
  };
}

export interface InsightsSituation {
  battingLabel: string;
  bowlingLabel: string;
  inningsType: string;
  inningsMode: string;
  requiredRunRate: number | null;
  currentRunRate: number | null;
  rawDisplay: string;
  battingTeam?: string | null;
  bowlingTeam?: string | null;
  over: number;
  runs: number;
  wickets: number;
  target: number | null;
  matchGender: string;
  battingContext: string;
  bowlingContext: string;
}

export interface BattingRecommendation {
  player: string;
  team: string;
  imageUrl?: string | null;
  expRuns: number;
  sdRuns: number;
  situationStrikeRate: number;
  dismissalProbability: number;
  entryCount: number;
  phaseDominance: number;
  consistency: number;
  pressureScore: number;
  situationSuitability: number;
  modelScore?: number | null;
  phase: string;
  reasons: string[];
}

export interface BowlingRecommendation {
  player: string;
  team: string;
  expectedWickets: number;
  expectedRunsConceded: number;
  wicketsStd: number;
  runsStd: number;
  utilityScore: number;
  oversSample: number;
  reasons: string[];
}

export interface InsightsAdvisorResponse {
  situation: InsightsSituation;
  battingRecommendations: BattingRecommendation[];
  bowlingRecommendations: BowlingRecommendation[];
  warnings: string[];
}

export interface EvaluationSummary {
  top1Accuracy: number;
  top3Accuracy: number;
  coverage: number;
  meanRankOfActualBest: number;
  improvementPct: number;
  bayesMeanRuns: number;
  baselineMeanRuns: number;
  sampleSituations: number;
  cached: boolean;
}

export interface EvaluationCalibrationRow {
  situation_label: string;
  mean_predicted: number;
  mean_actual: number;
  calibrationGap: number;
}

export interface EvaluationSituationRow {
  situation_label: string;
  innings_type?: string;
  inningsType?: string;
  p1_hit?: boolean;
  p3_hit?: boolean;
  rank_of_best?: number;
  our_top_runs?: number;
  baseline_runs?: number;
  improvement?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface InsightsEvaluationResponse {
  summary: EvaluationSummary;
  calibration: EvaluationCalibrationRow[];
  situations: EvaluationSituationRow[];
}

export interface PlayerExplorerSummary {
  player: string;
  requestedPlayer?: string | null;
  team?: string | null;
  imageUrl?: string | null;
  situations: number;
  avgExpectedRuns: number;
  totalEntries: number;
  dismissalRate: number | null;
  avgSituationStrikeRate: number | null;
  strongestPhase: string | null;
  pdiByPhase: {
    Powerplay?: number | null;
    Middle?: number | null;
    Death?: number | null;
  };
}

export interface PlayerSituationProfile {
  situation_label: string;
  innings_type?: string | null;
  entry_count?: number | null;
  avg_runs_after_entry?: number | null;
  median_runs_after_entry?: number | null;
  avg_strike_rate_after_entry?: number | null;
  dismissal_probability?: number | null;
}

export interface PlayerExplorerResponse {
  summary: PlayerExplorerSummary;
  profiles: PlayerSituationProfile[];
}

export interface LiveAdvisorResponse extends InsightsAdvisorResponse {
  match: {
    id: string;
    name: string;
    status: string;
    venue: string;
    matchType: string;
  };
  sourceContext: {
    runs: number;
    wickets: number;
    overs: number;
    innings: number;
    target: number | null;
    battingTeam: string;
    bowlingTeam: string;
    matchGender: string;
  };
}
