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

import { Match, Score, TeamInfo } from "@/types/cricket";

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
  league?: SMLeague;
  venue?: SMVenue;
}

interface SMResponse<T> {
  data: T;
  links?: unknown;
  meta?: unknown;
}

// ── Fetch helper ─────────────────────────────────────────────────────

async function smFetch<T>(
  path: string,
  params: Record<string, string> = {},
  revalidateSeconds = 30
): Promise<T | null> {
  if (!API_TOKEN) {
    return null; // Token not set — caller falls back to mock
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_token", API_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: revalidateSeconds },
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

  if (fixture.live) return { matchStarted: true, matchEnded: false };
  if (NS_STATUSES.has(s)) return { matchStarted: false, matchEnded: false };
  if (FINISHED_STATUSES.some((k) => s.includes(k)) || fixture.winner_team_id != null)
    return { matchStarted: true, matchEnded: true };
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

  // Live match — show innings status
  if (fixture.live) {
    return `LIVE · ${fixture.status || "In Progress"}`;
  }

  // Not started — show scheduled kick-off time
  if (NS_STATUSES.has(s)) {
    return formatStartTime(fixture.starting_at);
  }

  // Result
  if (fixture.winner_team_id) {
    const winner =
      fixture.winner_team_id === fixture.localteam_id
        ? fixture.localteam?.name
        : fixture.visitorteam?.name;
    return `${winner ?? "Home"} won`;
  }
  if (fixture.draw_noresult) return "No Result / Draw";

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

/**
 * Fetch all live fixtures from SportMonks.
 * Returns null if the token is not configured.
 */
export async function getSMLivescores(): Promise<Match[] | null> {
  const data = await smFetch<SMFixture[]>("/livescores", {
    include: INCLUDES,
  }, 20);

  if (!data) return null;
  return data.map(normaliseFixture);
}

/**
 * Fetch a single fixture by ID with full includes.
 */
export async function getSMFixture(id: string): Promise<Match | null> {
  const data = await smFetch<SMFixture>(`/fixtures/${id}`, {
    include: `${INCLUDES},scorecard`,
  }, 20);

  if (!data) return null;
  return normaliseFixture(data);
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
  }, 300);

  if (!data) return null;
  return data
    .map(normaliseFixture)
    .filter((m) => !m.matchStarted)
    .sort((a, b) => a.dateTimeGMT.localeCompare(b.dateTimeGMT))
    .slice(0, 20);
}

/** Health check — returns true if token is configured */
export function isSportMonksConfigured(): boolean {
  return API_TOKEN.length > 0;
}
