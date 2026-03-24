/**
 * CricAPI Service Layer
 * Fetches match data from the series_info endpoint and transforms
 * it into the app's Match interface.
 */
import type { Match } from "@/types/cricket";

const API_KEY =
  process.env.CRICKET_API_KEY || process.env.REACT_APP_CRICAPI_KEY || "";
const SERIES_ID =
  process.env.CRICKET_SERIES_ID ||
  process.env.CRICKET_SERIES_ID_IPL ||
  process.env.REACT_APP_SERIES_ID ||
  "";
const BASE_URL = "https://api.cricapi.com/v1";

// ─── Raw API types ──────────────────────────────────────────────────────────

interface RawTeamInfo {
  name?: string;
  shortname?: string;
  img?: string;
}

interface RawScore {
  r?: number;
  w?: number;
  o?: number;
  inning?: string;
}

interface RawMatch {
  id: string;
  name: string;
  status?: string;
  venue?: string;
  date?: string;
  dateTimeGMT?: string;
  teams?: string[];
  teamInfo?: RawTeamInfo[];
  score?: RawScore[];
  matchStarted?: boolean;
  matchEnded?: boolean;
  matchType?: string;
}

interface SeriesInfoResponse {
  status: string;
  data?: {
    info?: unknown;
    matchList?: RawMatch[];
  };
}

interface CurrentMatchesResponse {
  status: string;
  data?: RawMatch[];
}

interface RawSeries {
  id: string;
  name?: string;
  startDate?: string;
  endDate?: string;
}

interface SeriesListResponse {
  status: string;
  data?: RawSeries[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise the raw score array from CricAPI into the app's Score interface.
 * Handles empty arrays, partial innings, and missing fields gracefully.
 */
export function formatScore(scoreArray: RawScore[] | undefined): import("@/types/cricket").Score[] {
  if (!scoreArray || scoreArray.length === 0) return [];
  return scoreArray.map((s) => ({
    r: s.r ?? 0,
    w: s.w ?? 0,
    o: s.o ?? 0,
    inning: s.inning ?? "",
  }));
}

function extractMatchType(name: string): string {
  const u = name.toUpperCase();
  if (u.includes("TEST")) return "Test";
  if (u.includes("T20I") || u.includes("T20 I")) return "T20I";
  if (u.includes("T20")) return "T20";
  if (u.includes("ODI")) return "ODI";
  if (u.includes("FC")) return "FC";
  return "T20";
}

// ─── Transformation ─────────────────────────────────────────────────────────

/**
 * Normalise a raw CricAPI matchList entry into the app's Match interface.
 * Handles missing teamInfo, missing images, and missing venue gracefully.
 */
export function transformMatch(raw: RawMatch): Match {
  const ti = raw.teamInfo ?? [];

  const team1Name = ti[0]?.name || raw.teams?.[0] || "Team 1";
  const team2Name = ti[1]?.name || raw.teams?.[1] || "Team 2";

  return {
    id: raw.id,
    name: raw.name,
    matchType: raw.matchType || extractMatchType(raw.name),
    status: raw.status || "",
    venue: raw.venue || "",
    date: raw.date || raw.dateTimeGMT?.split("T")[0] || "",
    dateTimeGMT: raw.dateTimeGMT || raw.date || "",
    teams: raw.teams?.length ? raw.teams : [team1Name, team2Name],
    teamInfo: [
      {
        name: team1Name,
        shortname:
          ti[0]?.shortname ||
          (raw.teams?.[0]?.slice(0, 3).toUpperCase() ?? "T1"),
        img: ti[0]?.img || "",
      },
      {
        name: team2Name,
        shortname:
          ti[1]?.shortname ||
          (raw.teams?.[1]?.slice(0, 3).toUpperCase() ?? "T2"),
        img: ti[1]?.img || "",
      },
    ],
    score: formatScore(raw.score),
    matchStarted: raw.matchStarted ?? false,
    matchEnded: raw.matchEnded ?? false,
  };
}

// ─── Classification helpers (exported for consumers) ────────────────────────

export function isLiveMatch(m: Match): boolean {
  return m.matchStarted === true && m.matchEnded === false;
}

export function isUpcomingMatch(m: Match): boolean {
  return m.matchStarted === false;
}

export function isCompletedMatch(m: Match): boolean {
  return m.matchEnded === true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Series-info path requires both key + series ID */
export function isCricApiConfigured(): boolean {
  return Boolean(API_KEY && SERIES_ID);
}

/** currentMatches path requires only the API key */
export function isCricApiKeySet(): boolean {
  return Boolean(API_KEY);
}

/**
 * Fetch matches from the CricAPI `matches` endpoint.
 * Broader than currentMatches — includes upcoming scheduled matches.
 */
export async function getMatches(): Promise<Match[]> {
  if (!API_KEY) return [];

  try {
    const url = `${BASE_URL}/matches?apikey=${API_KEY}&offset=0`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error(`[cricapi] /matches HTTP ${res.status}`);
      return [];
    }

    const json: CurrentMatchesResponse = await res.json();

    if (json.status !== "success" || !json.data) return [];

    const seen = new Set<string>();
    return json.data
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map(transformMatch);
  } catch (err) {
    console.error("[cricapi] getMatches failed:", err);
    return [];
  }
}

/**
 * Fetch live + upcoming matches from the CricAPI `currentMatches` endpoint.
 * Always uses cache: "no-store" so callers get fresh data on every request.
 * Returns all matches — callers can filter for live/upcoming/completed.
 */
export async function getCurrentMatches(): Promise<Match[]> {
  if (!API_KEY) {
    console.warn("[cricapi] CRICKET_API_KEY not set — skipping currentMatches");
    return [];
  }

  try {
    const url = `${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      if (res.status === 401) console.error("[cricapi] Invalid API key (401)");
      else if (res.status === 429) console.error("[cricapi] Rate limit exceeded (429)");
      else console.error(`[cricapi] currentMatches HTTP ${res.status}`);
      return [];
    }

    const json: CurrentMatchesResponse = await res.json();

    if (json.status !== "success" || !json.data) {
      console.error("[cricapi] currentMatches non-success:", json.status);
      return [];
    }

    // Deduplicate by id before transforming
    const seen = new Set<string>();
    return json.data
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map(transformMatch);
  } catch (err) {
    console.error("[cricapi] getCurrentMatches failed:", err);
    return [];
  }
}

/**
 * Fetch all matches for the configured series from CricAPI.
 * Returns an empty array (never throws) on any error so callers can fall back.
 */
export async function getSeriesMatches(
  revalidateSeconds = 30
): Promise<Match[]> {
  if (!isCricApiConfigured()) {
    console.warn("[cricapi] CRICKET_API_KEY or CRICKET_SERIES_ID not set");
    return [];
  }

  try {
    const url = `${BASE_URL}/series_info?apikey=${API_KEY}&id=${SERIES_ID}`;

    const res = await fetch(url, {
      next: { revalidate: revalidateSeconds },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.error("[cricapi] Invalid API key (401)");
      } else if (res.status === 429) {
        console.error("[cricapi] Rate limit exceeded (429)");
      } else {
        console.error(`[cricapi] HTTP ${res.status} ${res.statusText}`);
      }
      return [];
    }

    const json: SeriesInfoResponse = await res.json();

    if (json.status !== "success") {
      console.error("[cricapi] Non-success status:", json.status);
      return [];
    }

    const matchList = json.data?.matchList ?? [];

    if (matchList.length === 0) {
      console.warn("[cricapi] matchList is empty for series:", SERIES_ID);
      return [];
    }

    return matchList.map(transformMatch);
  } catch (err) {
    console.error("[cricapi] Fetch failed:", err);
    return [];
  }
}

/**
 * Fetch live matches by:
 *   1. GET /v1/series  → list of all series
 *   2. Filter to series active today (startDate ≤ now ≤ endDate)
 *   3. GET /v1/series_info for each (parallel, capped at 6)
 *   4. Return only matches where matchStarted=true AND matchEnded=false
 *
 * This gives comprehensive live coverage across all ongoing series,
 * not just the single series pinned in the env.
 */
export async function getLiveMatchesFromSeries(): Promise<Match[]> {
  if (!API_KEY) {
    console.warn("[cricapi] CRICKET_API_KEY not set — skipping getLiveMatchesFromSeries");
    return [];
  }

  try {
    // Step 1: fetch the series list
    const seriesRes = await fetch(
      `${BASE_URL}/series?apikey=${API_KEY}&offset=0`,
      { cache: "no-store" }
    );

    if (!seriesRes.ok) {
      console.error(`[cricapi] /series HTTP ${seriesRes.status}`);
      return [];
    }

    const seriesJson: SeriesListResponse = await seriesRes.json();

    if (seriesJson.status !== "success" || !seriesJson.data?.length) {
      console.warn("[cricapi] /series returned no data");
      return [];
    }

    // Step 2: keep only series whose date window includes today
    const now = Date.now();
    const activeSeries = seriesJson.data
      .filter((s) => {
        if (!s.startDate || !s.endDate) return true; // include if dates missing
        const start = new Date(s.startDate).getTime();
        const end   = new Date(s.endDate).getTime() + 24 * 60 * 60 * 1000; // inclusive end-day
        return now >= start && now <= end;
      })
      .slice(0, 6); // cap to avoid blowing the rate limit

    if (activeSeries.length === 0) return [];

    // Step 3: fetch series_info for each active series in parallel
    const results = await Promise.allSettled(
      activeSeries.map((s) =>
        fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${s.id}`, {
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : null))
      )
    );

    // Step 4: collect live matches, deduplicate by id
    const seen  = new Set<string>();
    const live: Match[] = [];

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const json: SeriesInfoResponse = result.value;
      if (json.status !== "success") continue;

      for (const raw of json.data?.matchList ?? []) {
        if (seen.has(raw.id)) continue;
        seen.add(raw.id);
        if (raw.matchStarted === true && raw.matchEnded === false) {
          live.push(transformMatch(raw));
        }
      }
    }

    return live;
  } catch (err) {
    console.error("[cricapi] getLiveMatchesFromSeries failed:", err);
    return [];
  }
}
