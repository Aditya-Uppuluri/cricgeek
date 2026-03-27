export interface Match {
  id: string;
  name: string;
  matchType: string; // T20, ODI, Test
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo: TeamInfo[];
  score: Score[];
  series_id?: string;
  fantasyEnabled?: boolean;
  bbbEnabled?: boolean;
  hasSquad?: boolean;
  matchStarted: boolean;
  matchEnded: boolean;
}

export interface TeamInfo {
  name: string;
  shortname: string;
  img: string;
}

export interface Score {
  r: number; // runs
  w: number; // wickets
  o: number; // overs
  inning: string;
}

export interface Scorecard {
  batting: BattingEntry[];
  bowling: BowlingEntry[];
  extras: string;
  totalRuns: number;
  totalWickets: number;
  totalOvers: number;
  inning: string;
}

export interface BattingEntry {
  batsman: BatsmanInfo;
  dismissal: string;
  r: number;
  b: number;
  "4s": number;
  "6s": number;
  sr: string;
}

export interface BatsmanInfo {
  id: string;
  name: string;
}

export interface BowlingEntry {
  bowler: BowlerInfo;
  o: number;
  m: number;
  r: number;
  w: number;
  eco: string;
}

export interface BowlerInfo {
  id: string;
  name: string;
}

export interface Commentary {
  bbb: BallByBall[];
}

export interface BallByBall {
  id: string;
  over: number;
  ball: number;
  score: number;
  batsman: string;
  bowler: string;
  commentary: string;
  timestamp: string;
}

export interface Squad {
  teamName: string;
  shortname: string;
  img: string;
  players: Player[];
}

export interface Player {
  id: string;
  name: string;
  role?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  country?: string;
  playerImg?: string;
}

export interface CalendarMatch {
  id: string;
  name: string;
  matchType: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo: TeamInfo[];
  venue: string;
  status: string;
  series_id?: string;
}

export interface MatchAnalysis {
  id: string;
  matchId: string;
  type: "pre-match" | "post-match";
  title: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface MatchPreviewIntel {
  headline: string;
  summary: string;
  keyQuestions: string[];
  tacticalAngles: string[];
  watchPlayers: string[];
  predictedPressurePhase: string;
}

export interface PostMatchEdaCard {
  id: string;
  label: string;
  value: string;
  insight: string;
  tone?: "neutral" | "good" | "warning";
}

export interface PostMatchIntel {
  headline: string;
  summary: string;
  turningPoints: string[];
  tacticalTakeaways: string[];
  standoutPerformers: string[];
  edaCards: PostMatchEdaCard[];
}

export interface VenueInfo {
  name: string;
  city: string;
  country: string;
  capacity?: number;
  pitchType?: string;
  avgFirstInningsScore?: number;
  description?: string;
}
