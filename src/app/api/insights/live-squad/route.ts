import { NextResponse } from "next/server";
import type { SMFixture } from "@/lib/sportmonks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL =
  process.env.SPORTMONKS_BASE_URL || "https://cricket.sportmonks.com/api/v2.0";
const API_TOKEN = process.env.SPORTMONKS_API_TOKEN || "";

// ── Types ─────────────────────────────────────────────────────────────────

export interface LiveSquadResponse {
  matchId: string;
  /** Whether a recommendation trigger has fired */
  shouldTrigger: boolean;
  /** Reason the trigger fired (for debugging) */
  triggerReason: string | null;
  /** Player names currently active in the match (Playing XI + impact substitutes) */
  squad: string[];
  /** Current match situation summary */
  situation: {
    runs: number;
    wickets: number;
    overs: number;
    innings: number;
    battingTeam: string;
    bowlingTeam: string;
    lastWicketOver: number | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function fetchFixture(id: string): Promise<SMFixture | null> {
  if (!API_TOKEN) return null;

  const url = new URL(`${BASE_URL}/fixtures/${id}`);
  url.searchParams.set("api_token", API_TOKEN);
  url.searchParams.set("include", "localteam,visitorteam,lineup,balls,runs");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? null) as SMFixture | null;
  } catch {
    return null;
  }
}

/**
 * Extract player names from the lineup include.
 * The lineup contains all squad members announced by both teams.
 * We cap at 15 per team side to exclude coaching staff rows.
 */
function extractSquadNames(fixture: SMFixture): string[] {
  const lineup = Array.isArray(fixture.lineup) ? fixture.lineup : [];
  const names: string[] = [];

  for (const player of lineup as Array<Record<string, unknown>>) {
    const fullname =
      typeof player.fullname === "string"
        ? player.fullname
        : [player.firstname, player.lastname]
            .filter((p) => typeof p === "string" && (p as string).trim())
            .join(" ");

    if (fullname.trim()) {
      names.push(fullname.trim());
    }
  }

  // Deduplicate & return (capped at 30 total = 15 per side)
  return [...new Set(names)].slice(0, 30);
}

/**
 * Derive match situation from runs include.
 * Returns null if no scoring has occurred yet.
 */
function deriveSituation(fixture: SMFixture): LiveSquadResponse["situation"] {
  const runs = Array.isArray(fixture.runs) ? fixture.runs : [];
  if (runs.length === 0) return null;

  const sorted = [...runs].sort((a, b) => (b.inning ?? 0) - (a.inning ?? 0));
  const current = sorted[0];

  const localTeam = fixture.localteam;
  const visitorTeam = fixture.visitorteam;

  const battingTeamName =
    current.team_id === localTeam?.id
      ? (localTeam?.name ?? "")
      : current.team_id === visitorTeam?.id
        ? (visitorTeam?.name ?? "")
        : `Team ${current.team_id}`;

  const bowlingTeamName =
    battingTeamName === localTeam?.name
      ? (visitorTeam?.name ?? "")
      : (localTeam?.name ?? "");

  return {
    runs: current.score ?? 0,
    wickets: current.wickets ?? 0,
    overs: current.overs ?? 0,
    innings: current.inning ?? 1,
    battingTeam: battingTeamName,
    bowlingTeam: bowlingTeamName,
    lastWicketOver: null, // populated below from balls
  };
}

/**
 * Determine whether a recommendation should be triggered.
 *
 * Trigger conditions:
 *   A) A wicket just fell (any isWicket ball in the last 6 legal balls)
 *   B) 4 overs have elapsed since the last trigger epoch (overs are modulo 4)
 *
 * The "last trigger" is tracked via a query parameter `lastTriggerOver` sent
 * from the client, defaulting to -1 (never triggered).
 */
function detectTrigger(
  balls: Array<Record<string, unknown>>,
  situation: LiveSquadResponse["situation"],
  lastTriggerOver: number
): { shouldTrigger: boolean; reason: string | null; lastWicketOver: number | null } {
  if (!situation) {
    return { shouldTrigger: false, reason: null, lastWicketOver: null };
  }

  const currentOver = Math.floor(situation.overs);

  // ── Wicket trigger ───────────────────────────────────────────────────────
  // Look at balls from the current innings only; check recent 12 entries for a wicket.
  const recentBalls = [...balls].slice(-12);
  let lastWicketOver: number | null = null;

  for (const ball of recentBalls) {
    const score = (ball.score as Record<string, unknown>) ?? {};
    const isWicket = Boolean(score.is_wicket || score.out || ball.wicket_id);
    if (isWicket) {
      const ballNum = parseFloat(String(ball.ball ?? 0));
      lastWicketOver = Math.floor(ballNum);
    }
  }

  if (lastWicketOver !== null && lastWicketOver > lastTriggerOver) {
    return {
      shouldTrigger: true,
      reason: `wicket at over ${lastWicketOver}`,
      lastWicketOver,
    };
  }

  // ── 4-over block trigger ──────────────────────────────────────────────────
  // Fire when we enter a new 4-over block and haven't yet triggered this block.
  const currentBlock = Math.floor(currentOver / 4) * 4; // e.g. overs 8.x → block 8
  const lastBlock = Math.floor(Math.max(0, lastTriggerOver) / 4) * 4;

  if (currentBlock > lastBlock && currentOver >= currentBlock) {
    return {
      shouldTrigger: true,
      reason: `4-over block: over ${currentBlock}`,
      lastWicketOver,
    };
  }

  return { shouldTrigger: false, reason: null, lastWicketOver };
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId");
  const lastTriggerOver = Number(url.searchParams.get("lastTriggerOver") ?? -1);

  if (!matchId) {
    return NextResponse.json(
      { error: "matchId is required" },
      { status: 400 }
    );
  }

  const fixture = await fetchFixture(matchId);
  if (!fixture) {
    // SportsMonks token not configured or fixture not found — return a
    // minimal valid response so the UI degrades gracefully.
    return NextResponse.json<LiveSquadResponse>({
      matchId,
      shouldTrigger: false,
      triggerReason: null,
      squad: [],
      situation: null,
    });
  }

  const squad = extractSquadNames(fixture);
  const situation = deriveSituation(fixture);

  const balls = Array.isArray(fixture.balls)
    ? (fixture.balls as Array<Record<string, unknown>>)
    : [];

  const { shouldTrigger, reason, lastWicketOver } = detectTrigger(
    balls,
    situation,
    isNaN(lastTriggerOver) ? -1 : lastTriggerOver
  );

  if (situation && lastWicketOver !== null) {
    situation.lastWicketOver = lastWicketOver;
  }

  return NextResponse.json<LiveSquadResponse>({
    matchId,
    shouldTrigger,
    triggerReason: reason,
    squad,
    situation,
  });
}
