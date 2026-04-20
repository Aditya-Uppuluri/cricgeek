import { NextResponse } from "next/server";
import { forwardInsightsService } from "@/lib/ai-service";
import { getMatchInfo } from "@/lib/cricket-api";
import type { Match, Score } from "@/types/cricket";

export const runtime = "nodejs";
export const maxDuration = 120;

function isT20Match(match: Match) {
  return /t20/i.test(match.matchType);
}

function inferMatchGender(match: Match) {
  const haystack = `${match.name} ${match.status} ${match.teams.join(" ")}`.toLowerCase();
  return haystack.includes("women") ? "female" : "male";
}

function inferBattingTeam(score: Score, match: Match, inningsIndex: number) {
  const label = score.inning.toLowerCase();

  for (const team of match.teamInfo) {
    if (label.includes(team.name.toLowerCase()) || label.includes(team.shortname.toLowerCase())) {
      return team.name;
    }
  }

  for (const team of match.teams) {
    if (label.includes(team.toLowerCase())) {
      return team;
    }
  }

  return match.teams[inningsIndex] || match.teams[0] || score.inning;
}

function deriveLiveState(match: Match) {
  const populatedScores = match.score.filter((score) => score.r > 0 || score.w > 0 || score.o > 0);

  if (populatedScores.length === 0) {
    throw new Error("This match has not started scoring yet.");
  }

  const currentScore = populatedScores[populatedScores.length - 1];
  const innings = Math.min(2, populatedScores.length);
  const battingTeam = inferBattingTeam(currentScore, match, innings - 1);
  const bowlingTeam = match.teams.find((team) => team !== battingTeam) || "";
  const target = innings === 2 && populatedScores[0] ? populatedScores[0].r + 1 : null;

  return {
    runs: currentScore.r,
    wickets: currentScore.w,
    overs: currentScore.o,
    innings,
    target,
    battingTeam,
    bowlingTeam,
    matchGender: inferMatchGender(match),
  };
}

// ── Squad filtering helpers ──────────────────────────────────────────────

function normaliseForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

/**
 * Returns true if the candidate player name (from the advisor) is present
 * in the allowed squad list.  Uses a lenient substring match because player
 * names may differ slightly between the insights model (Cricsheet) and
 * SportsMonks (e.g. "V Kohli" vs "Virat Kohli").
 */
function inSquad(playerName: string, squad: string[]): boolean {
  if (squad.length === 0) return true; // no filter applied
  const normCandidate = normaliseForMatch(playerName);
  for (const squadName of squad) {
    const normSquad = normaliseForMatch(squadName);
    // Match if either string contains the other (handles short vs full names)
    if (normSquad.includes(normCandidate) || normCandidate.includes(normSquad)) {
      return true;
    }
    // Substring match on last word (surname) as a fallback
    const candidateSurname = normCandidate.split(" ").pop() ?? "";
    const squadSurname = normSquad.split(" ").pop() ?? "";
    if (candidateSurname.length > 3 && squadSurname === candidateSurname) {
      return true;
    }
  }
  return false;
}

function applySquadFilter(
  advisor: Record<string, unknown>,
  squad: string[]
): Record<string, unknown> {
  if (squad.length === 0) return advisor;

  const filterItems = (items: unknown): unknown[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => {
      const rec = item as Record<string, unknown>;
      const name =
        String(rec.player ?? rec.name ?? rec.batter ?? rec.batsman ?? "");
      return name ? inSquad(name, squad) : true;
    });
  };

  return {
    ...advisor,
    // Filter the primary recommendation list (may be called 'recommendations', 'batters', etc.)
    ...(Array.isArray(advisor.recommendations)
      ? { recommendations: filterItems(advisor.recommendations) }
      : {}),
    ...(Array.isArray(advisor.batters)
      ? { batters: filterItems(advisor.batters) }
      : {}),
    ...(Array.isArray(advisor.bowlers)
      ? { bowlers: filterItems(advisor.bowlers) }
      : {}),
    ...(Array.isArray(advisor.players)
      ? { players: filterItems(advisor.players) }
      : {}),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    const strategy = url.searchParams.get("strategy") || "balanced";
    const topN = Number(url.searchParams.get("topN") || 5);
    // squad = comma-separated player names from the live Playing XI
    const squadParam = url.searchParams.get("squad") ?? "";
    const squad = squadParam
      ? squadParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    const match = await getMatchInfo(matchId, { fresh: true });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (!isT20Match(match)) {
      return NextResponse.json(
        { error: "AI decision support is currently available for T20 matches only." },
        { status: 400 }
      );
    }

    const state = deriveLiveState(match);
    const upstream = await forwardInsightsService(
      "/t20-insights/advisor",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runs: state.runs,
          wickets: state.wickets,
          overs: state.overs,
          innings: state.innings,
          target: state.target,
          batting_team: state.battingTeam,
          bowling_team: state.bowlingTeam,
          match_gender: state.matchGender,
          strategy,
          top_n: Number.isFinite(topN) ? topN : 5,
        }),
      },
      request
    );

    if (!upstream.ok) {
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: { "Content-Type": upstream.contentType },
      });
    }

    const rawAdvisor = JSON.parse(upstream.body) as Record<string, unknown>;
    const advisor = applySquadFilter(rawAdvisor, squad);

    return NextResponse.json({
      ...advisor,
      match: {
        id: match.id,
        name: match.name,
        status: match.status,
        venue: match.venue,
        matchType: match.matchType,
      },
      sourceContext: state,
      squadFiltered: squad.length > 0,
    });
  } catch (error) {
    console.error("Insights live proxy error:", error);
    const detail =
      error instanceof Error ? error.message : "Unable to derive live match context.";
    const isLocalInsightsConnectionIssue =
      process.env.NODE_ENV !== "production" && /fetch failed|ECONNREFUSED/i.test(detail);

    return NextResponse.json(
      {
        error: isLocalInsightsConnectionIssue
          ? "Unable to reach the T20 insights service. Start it with `npm run dev:insights`."
          : detail,
      },
      { status: 502 }
    );
  }
}
