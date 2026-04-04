/**
 * SportMonks Cricket API v2 Client
 *
 * Endpoints used:
 *   - GET /livescores                       → all live fixtures
 *   - GET /fixtures/{id}                    → single fixture detail
 *   - GET /fixtures?filter[starts_between]  → upcoming fixtures
 *
 * Includes are appended as query params:
 *   include=localteam,visitorteam,runs,league
 *
 * Token is passed via api_token query param (never exposed to browser).
 * All responses are normalised to the existing `Match` type so the UI
 * doesn't need any changes.
 */

import { BattingEntry, BowlingEntry, Commentary, Match, Player, Score, Scorecard, Squad, TeamInfo } from "@/types/cricket";

const BASE_URL =
  process.env.SPORTMONKS_BASE_URL ||
  "https://cricket.sportmonks.com/api/v2.0";
const API_TOKEN = process.env.SPORTMONKS_API_TOKEN || "";

// ── Raw SportMonks shapes ────────────────────────────────────────────

export interface SMRun {
  id: number;
  fixture_id: number;
  team_id: number;
  inning: number;
  score: number | null;
  wickets: number | null;
  overs: number | null;
  pp1: string | null;
  pp2: string | null;
  pp3: string | null;
  updated_at: string;
}

export interface SMTeam {
  id: number;
  name: string;
  code: string;
  image_path: string;
  country_id: number;
  national_team: boolean;
}

export interface SMLeague {
  id: number;
  name: string;
  code: string;
  image_path: string;
  country_id: number;
}

export interface SMVenue {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
}

export interface SMFixture {
  resource: string;
  id: number;
  league_id: number;
  season_id: number;
  stage_id: number;
  round: string | null;
  localteam_id: number;
  visitorteam_id: number;
  starting_at: string;
  type: string;        // "T20I", "ODI", "Test", "T20", etc.
  live: boolean;
  status: string;      // "1st Innings", "Stumps", "Finished", "Not Started", etc.
  last_period: string | null;
  note: string;
  venue_id: number | null;
  toss_won_team_id: number | null;
  winner_team_id: number | null;
  draw_noresult: boolean | null;
  elected: string | null;     // "batting" | "fielding"
  super_over: boolean;
  follow_on: boolean;
  total_overs_played: number | null;
  // Includes
  localteam?: SMTeam;
  visitorteam?: SMTeam;
  runs?: SMRun[];
  scorecards?: unknown;
  scorecard?: unknown;
  batting?: unknown;
  bowling?: unknown;
  balls?: unknown;
  lineup?: unknown;
  league?: SMLeague;
  venue?: SMVenue;
}

interface SMResponse<T> {
  data: T;
  links?: unknown;
  meta?: unknown;
}

interface SportMonksRequestOptions {
  fresh?: boolean;
  revalidateSeconds?: number;
}

// ── Fetch helper ─────────────────────────────────────────────────────

async function smFetch<T>(
  path: string,
  params: Record<string, string> = {},
  options: SportMonksRequestOptions = {}
): Promise<T | null> {
  if (!API_TOKEN) {
    return null; // Token not set — caller falls back to mock
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_token", API_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      ...(options.fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidateSeconds ?? 30 } }),
    });

    if (!res.ok) {
      console.error(
        `[SportMonks] ${path} → ${res.status} ${res.statusText}`
      );
      return null;
    }

    const json: SMResponse<T> = await res.json();
    return json.data ?? null;
  } catch (err) {
    console.error(`[SportMonks] fetch error for ${path}:`, err);
    return null;
  }
}

// ── Normalise a single fixture to Match ─────────────────────────────

// SM status codes that mean 'not yet started'
const NS_STATUSES = new Set(["ns", "not started", "sch", "scheduled", ""]);
// SM status codes that mean 'finished'
const FINISHED_STATUSES = [
  "finished", "completed", "result", "abandoned", "no result",
  "cancelled", "ld",
];

function statusToState(fixture: SMFixture): {
  matchStarted: boolean;
  matchEnded: boolean;
} {
  const s = fixture.status?.toLowerCase() ?? "";

  if (FINISHED_STATUSES.some((k) => s.includes(k)) || fixture.winner_team_id != null)
    return { matchStarted: true, matchEnded: true };
  if (fixture.live) return { matchStarted: true, matchEnded: false };
  if (NS_STATUSES.has(s)) return { matchStarted: false, matchEnded: false };
  return { matchStarted: true, matchEnded: false };
}

function formatStartTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return `Starts ${d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    })} IST`;
  } catch {
    return "Upcoming";
  }
}

function buildStatusLabel(fixture: SMFixture): string {
  const s = fixture.status?.toLowerCase() ?? "";

  // Result
  if (fixture.winner_team_id) {
    const winner =
      fixture.winner_team_id === fixture.localteam_id
        ? fixture.localteam?.name
        : fixture.winner_team_id === fixture.visitorteam_id
          ? fixture.visitorteam?.name
          : fixture.status;
    return `${winner ?? "Match"} won`;
  }
  if (fixture.draw_noresult) return "No Result / Draw";
  if (FINISHED_STATUSES.some((k) => s.includes(k))) {
    return fixture.status || "Finished";
  }

  // Live match — show innings status
  if (fixture.live) {
    return `LIVE · ${fixture.status || "In Progress"}`;
  }

  // Not started — show scheduled kick-off time
  if (NS_STATUSES.has(s)) {
    return formatStartTime(fixture.starting_at);
  }

  // In progress but not yet marked live
  if (fixture.status && !NS_STATUSES.has(s)) return fixture.status;

  return "—";
}

export function normaliseFixture(f: SMFixture): Match {
  const local = f.localteam;
  const visitor = f.visitorteam;
  const runs = f.runs ?? [];
  const { matchStarted, matchEnded } = statusToState(f);

  const teamInfo: TeamInfo[] = [
    {
      name: local?.name ?? `Team ${f.localteam_id}`,
      shortname: local?.code ?? String(f.localteam_id),
      img: local?.image_path ?? "",
    },
    {
      name: visitor?.name ?? `Team ${f.visitorteam_id}`,
      shortname: visitor?.code ?? String(f.visitorteam_id),
      img: visitor?.image_path ?? "",
    },
  ];

  // Map runs per team (can be multiple innings)
  const scoreMap: Record<number, Score[]> = {};
  for (const run of runs) {
    if (!scoreMap[run.team_id]) scoreMap[run.team_id] = [];
    scoreMap[run.team_id].push({
      r: run.score ?? 0,
      w: run.wickets ?? 0,
      o: run.overs ?? 0,
      inning: `Innings ${run.inning}`,
    });
  }

  const score: Score[] = [
    ...(scoreMap[f.localteam_id] ?? []),
    ...(scoreMap[f.visitorteam_id] ?? []),
  ];

  const teams = [
    local?.name ?? `Team ${f.localteam_id}`,
    visitor?.name ?? `Team ${f.visitorteam_id}`,
  ];

  const venueName = f.venue
    ? `${f.venue.name}${f.venue.city ? `, ${f.venue.city}` : ""}`
    : "";

  const matchLabel = `${teams[0]} vs ${teams[1]}`;
  const roundLabel = f.round ? ` — ${f.round}` : "";
  const leagueLabel = f.league ? ` (${f.league.name})` : "";

  return {
    id: String(f.id),
    name: `${matchLabel}${roundLabel}${leagueLabel}`,
    matchType: normaliseMatchType(f.type),
    status: buildStatusLabel(f),
    venue: venueName,
    date: f.starting_at?.split("T")[0] ?? "",
    dateTimeGMT: f.starting_at ?? "",
    teams,
    teamInfo,
    score,
    matchStarted,
    matchEnded,
  };
}

// ── Match type normalisation ─────────────────────────────────────────
// SportMonks uses lowercase type strings ("t20", "4day", "odm", etc.).
// Normalise to consistent uppercase short forms for badge display.
function normaliseMatchType(raw: string | undefined | null): string {
  if (!raw) return "T20";
  const t = raw.toLowerCase().trim();
  const MAP: Record<string, string> = {
    t20: "T20", t20i: "T20I",
    odi: "ODI", "odi-w": "ODI-W", odm: "ODI",
    test: "Test", "test-w": "Test",
    "4day": "4-Day", fc: "FC",
    "t10": "T10", "hundredball": "100-Ball",
    "list a": "List A", "lista": "List A",
  };
  return MAP[t] ?? raw.toUpperCase();
}

// ── Public API ────────────────────────────────────────────────────────

const INCLUDES = "localteam,visitorteam,runs,league,venue";
const DETAIL_INCLUDES = `${INCLUDES}`;
const SQUAD_INCLUDES = "localteam,visitorteam,lineup";
const SCORECARD_INCLUDES = "localteam,visitorteam,runs,batting,bowling,lineup";
const COMMENTARY_INCLUDES = "balls";

/**
 * Fetch all live fixtures from SportMonks.
 * Returns null if the token is not configured.
 */
export async function getSMLivescores(): Promise<Match[] | null> {
  const data = await smFetch<SMFixture[]>("/livescores", {
    include: INCLUDES,
  }, { revalidateSeconds: 20 });

  if (!data) return null;
  return data.map(normaliseFixture);
}

/**
 * Fetch a single fixture by ID with full includes.
 */
export async function getSMFixture(id: string, options: SportMonksRequestOptions = {}): Promise<Match | null> {
  const data = await smFetch<SMFixture>(`/fixtures/${id}`, {
    include: DETAIL_INCLUDES,
  }, { revalidateSeconds: 20, ...options });

  if (!data) return null;
  return normaliseFixture(data);
}

function normaliseBattingRow(row: Record<string, unknown>): BattingEntry {
  return {
    batsman: {
      id: String(row.player_id ?? row.playerId ?? row.id ?? row.batsman_id ?? row.batsmanId ?? "unknown"),
      name: String(row.player_name ?? row.playerName ?? row.batsman ?? row.name ?? "Unknown Batter"),
    },
    dismissal: String(row.result ?? row.dismissal ?? row.how_out ?? row.howOut ?? "batting"),
    r: Number(row.score ?? row.runs ?? row.r ?? 0),
    b: Number(row.ball ?? row.balls ?? row.b ?? 0),
    "4s": Number(row.four_x ?? row.fours ?? row["4s"] ?? 0),
    "6s": Number(row.six_x ?? row.sixes ?? row["6s"] ?? 0),
    sr: String(row.rate ?? row.strike_rate ?? row.strikeRate ?? "0"),
  };
}

function normaliseBowlingRow(row: Record<string, unknown>): BowlingEntry {
  return {
    bowler: {
      id: String(row.player_id ?? row.playerId ?? row.id ?? row.bowler_id ?? row.bowlerId ?? "unknown"),
      name: String(row.player_name ?? row.playerName ?? row.bowler ?? row.name ?? "Unknown Bowler"),
    },
    o: Number(row.overs ?? row.o ?? 0),
    m: Number(row.maidens ?? row.m ?? 0),
    r: Number(row.runs ?? row.r ?? 0),
    w: Number(row.wickets ?? row.w ?? 0),
    eco: String(row.rate ?? row.econ_rate ?? row.economy ?? row.eco ?? "0"),
  };
}

function normaliseScoreboardLabel(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function scoreboardsInOrder(labels: Iterable<string>): string[] {
  return [...new Set([...labels].filter(Boolean))].sort((left, right) => {
    const leftNum = Number.parseInt(left.replace(/[^0-9]/g, ""), 10);
    const rightNum = Number.parseInt(right.replace(/[^0-9]/g, ""), 10);

    if (Number.isNaN(leftNum) && Number.isNaN(rightNum)) return left.localeCompare(right);
    if (Number.isNaN(leftNum)) return 1;
    if (Number.isNaN(rightNum)) return -1;
    return leftNum - rightNum;
  });
}

function buildPlayerNameIndex(lineup: unknown, localTeam?: SMTeam, visitorTeam?: SMTeam) {
  const index = new Map<string, string>();
  const teamPlayers = new Map<number, Player[]>();

  if (!Array.isArray(lineup)) {
    return { playerNameById: index, teamPlayers };
  }

  for (const row of lineup) {
    const player = row as Record<string, unknown>;
    const id = String(player.id ?? "");
    const fullName =
      typeof player.fullname === "string"
        ? player.fullname
        : [player.firstname, player.lastname].filter((value) => typeof value === "string" && value.trim()).join(" ");

    if (id && fullName) {
      index.set(id, fullName);
    }

    const lineupMeta = (player.lineup as Record<string, unknown> | undefined) ?? {};
    const teamId = Number(lineupMeta.team_id ?? 0);
    if (!teamId) continue;

    const playerEntry: Player = {
      id: id || String(player.id ?? "unknown"),
      name: fullName || "Unknown Player",
      role: typeof (player.position as Record<string, unknown> | undefined)?.name === "string"
        ? String((player.position as Record<string, unknown>).name)
        : undefined,
      battingStyle: typeof player.battingstyle === "string" ? player.battingstyle : undefined,
      bowlingStyle: typeof player.bowlingstyle === "string" ? player.bowlingstyle : undefined,
      playerImg: typeof player.image_path === "string" ? player.image_path : undefined,
    };

    if (!teamPlayers.has(teamId)) teamPlayers.set(teamId, []);
    teamPlayers.get(teamId)!.push(playerEntry);
  }

  if (localTeam && !teamPlayers.has(localTeam.id)) {
    teamPlayers.set(localTeam.id, []);
  }
  if (visitorTeam && !teamPlayers.has(visitorTeam.id)) {
    teamPlayers.set(visitorTeam.id, []);
  }

  return { playerNameById: index, teamPlayers };
}

function parseSportMonksScorecards(fixture: SMFixture): Scorecard[] | null {
  const battingRows = Array.isArray(fixture.batting) ? fixture.batting : [];
  const bowlingRows = Array.isArray(fixture.bowling) ? fixture.bowling : [];
  const runs = Array.isArray(fixture.runs) ? fixture.runs : [];
  const { playerNameById } = buildPlayerNameIndex(fixture.lineup, fixture.localteam, fixture.visitorteam);

  const scoreboardLabels = scoreboardsInOrder([
    ...battingRows.map((row) => normaliseScoreboardLabel((row as Record<string, unknown>).scoreboard)),
    ...bowlingRows.map((row) => normaliseScoreboardLabel((row as Record<string, unknown>).scoreboard)),
  ]);

  const parsed = scoreboardLabels
    .map((scoreboardLabel, index) => {
      const battingSourceRow = battingRows.find(
        (row) => normaliseScoreboardLabel((row as Record<string, unknown>).scoreboard) === scoreboardLabel
      ) as Record<string, unknown> | undefined;
      const battingForInning = battingRows
        .filter((row) => normaliseScoreboardLabel((row as Record<string, unknown>).scoreboard) === scoreboardLabel)
        .map((row) => {
          const raw = row as Record<string, unknown>;
          return normaliseBattingRow({
            ...raw,
            player_name: playerNameById.get(String(raw.player_id ?? "")) ?? raw.player_name,
            dismissal:
              raw.active === true
                ? "batting"
                : Number(raw.wicket_id ?? 0) > 0
                  ? "out"
                  : "did not bat",
          });
        });

      const bowlingForInning = bowlingRows
        .filter((row) => normaliseScoreboardLabel((row as Record<string, unknown>).scoreboard) === scoreboardLabel)
        .map((row) => {
          const raw = row as Record<string, unknown>;
          return normaliseBowlingRow({
            ...raw,
            player_name: playerNameById.get(String(raw.player_id ?? "")) ?? raw.player_name,
            maidens: raw.medians,
          });
        });

      const battingTeamId = Number(battingSourceRow?.team_id ?? 0);
      const runRow =
        runs.find((run) => Number(run.inning ?? 0) === index + 1) ??
        runs.find((run) => Number(run.team_id) === battingTeamId) ??
        runs[index];
      const resolvedBattingTeamId = battingTeamId || Number(runRow?.team_id ?? 0);

      const battingTeamName =
        resolvedBattingTeamId === fixture.localteam?.id
          ? fixture.localteam.name
          : resolvedBattingTeamId === fixture.visitorteam?.id
            ? fixture.visitorteam.name
            : `Team ${resolvedBattingTeamId}`;

      return {
        inning: `${battingTeamName} Innings ${index + 1}`,
        totalRuns: Number(runRow?.score ?? 0),
        totalWickets: Number(runRow?.wickets ?? 0),
        totalOvers: Number(runRow?.overs ?? 0),
        extras: "",
        batting: battingForInning,
        bowling: bowlingForInning,
      };
    })
    .filter((inning) => inning.batting.length > 0 || inning.bowling.length > 0 || inning.totalRuns > 0);

  return parsed.length > 0 ? parsed : null;
}

export async function getSMScorecard(id: string, options: SportMonksRequestOptions = {}): Promise<Scorecard[] | null> {
  const data = await smFetch<SMFixture>(`/fixtures/${id}`, {
    include: SCORECARD_INCLUDES,
  }, { revalidateSeconds: 20, ...options });

  if (!data) return null;
  return parseSportMonksScorecards(data);
}

function decimalBallToParts(value: unknown) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(numeric)) {
    return { over: 0, ball: 0 };
  }

  const over = Math.floor(numeric);
  const ball = Math.round((numeric - over) * 10);
  return { over, ball };
}

function describeBallScore(score: Record<string, unknown>, ballLabel: string, bowler: string, batter: string, dismissedBatter?: string) {
  const scoreName = typeof score.name === "string" ? score.name : "";
  const runs = Number(score.runs ?? 0);
  const byes = Number(score.bye ?? 0);
  const legByes = Number(score.leg_bye ?? 0);
  const noBallRuns = Number(score.noball_runs ?? 0);
  const isWicket = Boolean(score.is_wicket || score.out);

  if (isWicket) {
    const wicketLabel = dismissedBatter ? `${dismissedBatter} is out` : "Wicket";
    return `${ballLabel} ${bowler} to ${batter}, ${scoreName || "Wicket"}! ${wicketLabel}.`;
  }

  if (byes > 0) return `${ballLabel} ${bowler} to ${batter}, ${byes} bye${byes === 1 ? "" : "s"}.`;
  if (legByes > 0) return `${ballLabel} ${bowler} to ${batter}, ${legByes} leg bye${legByes === 1 ? "" : "s"}.`;
  if (noBallRuns > 0 && runs === 0) return `${ballLabel} ${bowler} to ${batter}, no-ball for ${noBallRuns}.`;
  if (score.four) return `${ballLabel} ${bowler} to ${batter}, FOUR.`;
  if (score.six) return `${ballLabel} ${bowler} to ${batter}, SIX.`;
  if (runs === 0) return `${ballLabel} ${bowler} to ${batter}, no run.`;
  if (runs === 1) return `${ballLabel} ${bowler} to ${batter}, 1 run.`;
  return `${ballLabel} ${bowler} to ${batter}, ${runs} runs.`;
}

export async function getSMCommentary(id: string, options: SportMonksRequestOptions = {}): Promise<Commentary | null> {
  const data = await smFetch<SMFixture>(`/fixtures/${id}`, {
    include: COMMENTARY_INCLUDES,
  }, { revalidateSeconds: 10, ...options });

  if (!data || !Array.isArray(data.balls)) return null;

  const balls = data.balls as Array<Record<string, unknown>>;
  if (balls.length === 0) return null;

  const commentary = balls
    .map((entry) => {
      const { over, ball } = decimalBallToParts(entry.ball);
      const batter = typeof (entry.batsman as Record<string, unknown> | undefined)?.fullname === "string"
        ? String((entry.batsman as Record<string, unknown>).fullname)
        : "Unknown Batter";
      const bowler = typeof (entry.bowler as Record<string, unknown> | undefined)?.fullname === "string"
        ? String((entry.bowler as Record<string, unknown>).fullname)
        : "Unknown Bowler";
      const dismissedBatter = typeof entry.batsmanout_id === "number"
        ? undefined
        : undefined;
      const score = ((entry.score as Record<string, unknown> | undefined) ?? {});
      const scoreValue = Number(score.runs ?? 0) + Number(score.bye ?? 0) + Number(score.leg_bye ?? 0) + Number(score.noball_runs ?? 0);
      const ballLabel = `${over}.${ball}`;

      return {
        id: String(entry.id ?? `${over}-${ball}`),
        over,
        ball,
        score: Number.isFinite(scoreValue) ? scoreValue : 0,
        batsman: batter,
        bowler,
        commentary: describeBallScore(score, ballLabel, bowler, batter),
        timestamp: typeof entry.updated_at === "string" ? entry.updated_at : new Date().toISOString(),
      };
    })
    .sort((left, right) => {
      const leftValue = left.over * 10 + left.ball;
      const rightValue = right.over * 10 + right.ball;
      return rightValue - leftValue;
    });

  return { bbb: commentary };
}

export async function getSMSquads(id: string, options: SportMonksRequestOptions = {}): Promise<Squad[] | null> {
  const data = await smFetch<SMFixture>(`/fixtures/${id}`, {
    include: SQUAD_INCLUDES,
  }, { revalidateSeconds: 60, ...options });

  if (!data || !Array.isArray(data.lineup) || !data.localteam || !data.visitorteam) {
    return null;
  }

  const { teamPlayers } = buildPlayerNameIndex(data.lineup, data.localteam, data.visitorteam);
  const teams = [data.localteam, data.visitorteam];

  return teams.map((team) => ({
    teamName: team.name,
    shortname: team.code,
    img: team.image_path,
    players: teamPlayers.get(team.id) ?? [],
  }));
}

/**
 * Fetch upcoming fixtures (next 7 days).
 */
export async function getSMUpcoming(): Promise<Match[] | null> {
  const now = new Date();
  const future = new Date(now);
  future.setDate(now.getDate() + 7);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const data = await smFetch<SMFixture[]>("/fixtures", {
    include: INCLUDES,
    "filter[starts_between]": `${fmt(now)},${fmt(future)}`,
  }, { revalidateSeconds: 300 });

  if (!data) return null;
  return data
    .map(normaliseFixture)
    .filter((m) => !m.matchStarted)
    .sort((a, b) => a.dateTimeGMT.localeCompare(b.dateTimeGMT))
    .slice(0, 20);
}

export async function getSMRecentResults(): Promise<Match[] | null> {
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - 3);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const data = await smFetch<SMFixture[]>("/fixtures", {
    include: INCLUDES,
    "filter[starts_between]": `${fmt(past)},${fmt(now)}`,
  }, { revalidateSeconds: 120 });

  if (!data) return null;
  return data
    .map(normaliseFixture)
    .filter((m) => m.matchEnded)
    .sort((a, b) => b.dateTimeGMT.localeCompare(a.dateTimeGMT))
    .slice(0, 20);
}

/** Health check — returns true if token is configured */
export function isSportMonksConfigured(): boolean {
  return API_TOKEN.length > 0;
}

/**
 * Given a list of lowercase team code/name hints (e.g. ["kkr", "mi"]),
 * searches recent and upcoming fixtures to find the most recent match
 * involving each team, then fetches the full lineup for those fixtures
 * and returns the matching squads.
 *
 * Results are cached for 1 h via Next.js fetch cache so that per-transcription
 * calls don't hammer the SportMonks API.
 */
export async function getSMTeamRostersForHints(
  teamHints: string[]
): Promise<Squad[]> {
  if (!isSportMonksConfigured() || teamHints.length === 0) return [];

  // Wide window: 90 days back (covers full IPL season) + 14 days ahead
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - 90);
  const future = new Date(now);
  future.setDate(now.getDate() + 14);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  // Lightweight fixture list — just team info, no lineup (small response)
  const fixtures = await smFetch<SMFixture[]>(
    "/fixtures",
    { include: "localteam,visitorteam", "filter[starts_between]": `${fmt(past)},${fmt(future)}` },
    { revalidateSeconds: 3_600 }
  );

  if (!fixtures || fixtures.length === 0) return [];

  // Sort most-recent first
  const sorted = [...fixtures].sort((a, b) =>
    (b.starting_at ?? "").localeCompare(a.starting_at ?? "")
  );

  // For each hint find the most recent fixture that involves that team
  const hintToFixtureId = new Map<string, number>();
  for (const fixture of sorted) {
    for (const hint of teamHints) {
      if (hintToFixtureId.has(hint)) continue;
      const local = fixture.localteam;
      const visitor = fixture.visitorteam;
      const matchesTeam = (team: SMTeam | undefined) =>
        team &&
        (team.code?.toLowerCase() === hint ||
          team.name?.toLowerCase().includes(hint));
      if (matchesTeam(local) || matchesTeam(visitor)) {
        hintToFixtureId.set(hint, fixture.id);
      }
    }
    if (hintToFixtureId.size === teamHints.length) break; // found all
  }

  if (hintToFixtureId.size === 0) return [];

  // Deduplicate fixture IDs then fetch their full squads in parallel
  const uniqueIds = [...new Set(hintToFixtureId.values())];
  const squadResults = await Promise.all(
    uniqueIds.map((id) => getSMSquads(String(id), { fresh: false }))
  );

  // Collect only the squads that match a hint (skip opposing team if not hinted)
  const result: Squad[] = [];
  const addedNames = new Set<string>();

  for (const squads of squadResults) {
    if (!squads) continue;
    for (const squad of squads) {
      const nameL = squad.teamName?.toLowerCase() ?? "";
      const codeL = squad.shortname?.toLowerCase() ?? "";
      const matches = teamHints.some(
        (h) => codeL === h || codeL.startsWith(h) || nameL.includes(h)
      );
      if (matches && !addedNames.has(nameL)) {
        addedNames.add(nameL);
        result.push(squad);
      }
    }
  }

  return result;
}
