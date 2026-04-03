import { NextResponse } from "next/server";
import { forwardAiService } from "@/lib/ai-service";
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    const strategy = url.searchParams.get("strategy") || "balanced";
    const topN = Number(url.searchParams.get("topN") || 5);

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
    const upstream = await forwardAiService("/t20-insights/advisor", {
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
    });

    if (!upstream.ok) {
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: { "Content-Type": upstream.contentType },
      });
    }

    const advisor = JSON.parse(upstream.body) as Record<string, unknown>;

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
    });
  } catch (error) {
    console.error("Insights live proxy error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to derive live match context.",
      },
      { status: 502 }
    );
  }
}
