import type { Match, Score } from "@/types/cricket";

const API_KEY =
  process.env.CRICKET_API_KEY || process.env.REACT_APP_CRICAPI_KEY || "";
const SERIES_ID =
  process.env.CRICKET_SERIES_ID ||
  process.env.CRICKET_SERIES_ID_IPL ||
  process.env.REACT_APP_SERIES_ID ||
  "";
const BASE_URL = process.env.CRICKET_API_BASE_URL || "https://api.cricapi.com/v1";

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
    matchList?: RawMatch[];
  };
}

interface CurrentMatchesResponse {
  status: string;
  data?: RawMatch[];
}

function formatScore(scoreArray: RawScore[] | undefined): Score[] {
  if (!scoreArray || scoreArray.length === 0) return [];
  return scoreArray.map((score) => ({
    r: score.r ?? 0,
    w: score.w ?? 0,
    o: score.o ?? 0,
    inning: score.inning ?? "",
  }));
}

function extractMatchType(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes("TEST")) return "Test";
  if (upper.includes("T20I") || upper.includes("T20 I")) return "T20I";
  if (upper.includes("T20")) return "T20";
  if (upper.includes("ODI")) return "ODI";
  if (upper.includes("FC")) return "FC";
  return "T20";
}

function transformMatch(raw: RawMatch): Match {
  const teamInfo = raw.teamInfo ?? [];

  const team1Name = teamInfo[0]?.name || raw.teams?.[0] || "Team 1";
  const team2Name = teamInfo[1]?.name || raw.teams?.[1] || "Team 2";

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
          teamInfo[0]?.shortname ||
          (raw.teams?.[0]?.slice(0, 3).toUpperCase() ?? "T1"),
        img: teamInfo[0]?.img || "",
      },
      {
        name: team2Name,
        shortname:
          teamInfo[1]?.shortname ||
          (raw.teams?.[1]?.slice(0, 3).toUpperCase() ?? "T2"),
        img: teamInfo[1]?.img || "",
      },
    ],
    score: formatScore(raw.score),
    matchStarted: raw.matchStarted ?? false,
    matchEnded: raw.matchEnded ?? false,
  };
}

export function isCricApiConfigured(): boolean {
  return Boolean(API_KEY && SERIES_ID);
}

export function isCricApiKeySet(): boolean {
  return Boolean(API_KEY);
}

export async function getMatches(): Promise<Match[]> {
  if (!API_KEY) return [];

  try {
    const url = `${BASE_URL}/matches?apikey=${API_KEY}&offset=0`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      console.error(`[cricapi] /matches HTTP ${response.status}`);
      return [];
    }

    const json: CurrentMatchesResponse = await response.json();
    if (json.status !== "success" || !json.data) return [];

    const seen = new Set<string>();
    return json.data
      .filter((match) => {
        if (seen.has(match.id)) return false;
        seen.add(match.id);
        return true;
      })
      .map(transformMatch);
  } catch (error) {
    console.error("[cricapi] getMatches failed:", error);
    return [];
  }
}

export async function getCurrentMatches(): Promise<Match[]> {
  if (!API_KEY) return [];

  try {
    const url = `${BASE_URL}/currentMatches?apikey=${API_KEY}&offset=0`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      console.error(`[cricapi] currentMatches HTTP ${response.status}`);
      return [];
    }

    const json: CurrentMatchesResponse = await response.json();
    if (json.status !== "success" || !json.data) return [];

    const seen = new Set<string>();
    return json.data
      .filter((match) => {
        if (seen.has(match.id)) return false;
        seen.add(match.id);
        return true;
      })
      .map(transformMatch);
  } catch (error) {
    console.error("[cricapi] getCurrentMatches failed:", error);
    return [];
  }
}

export async function getSeriesMatches(revalidateSeconds = 30): Promise<Match[]> {
  if (!isCricApiConfigured()) return [];

  try {
    const url = `${BASE_URL}/series_info?apikey=${API_KEY}&id=${SERIES_ID}`;
    const response = await fetch(url, {
      next: { revalidate: revalidateSeconds },
    });

    if (!response.ok) {
      console.error(`[cricapi] series_info HTTP ${response.status}`);
      return [];
    }

    const json: SeriesInfoResponse = await response.json();
    if (json.status !== "success") return [];

    return (json.data?.matchList ?? []).map(transformMatch);
  } catch (error) {
    console.error("[cricapi] getSeriesMatches failed:", error);
    return [];
  }
}
