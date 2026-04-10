import { getMatchCommentary, getMatchScorecard } from "@/lib/cricket-api";
import { forwardInsightsService } from "@/lib/ai-service";
import {
  inferPhase,
  buildConfidence,
  buildFreshness,
  dedupeSources,
  clamp,
  round,
  getScheduledOvers,
} from "@/lib/eda/common";
import { buildLiveAnalyticsBundle } from "@/lib/eda/live-analytics";
import { getVenueSnapshot } from "@/lib/eda/historical";
import type { Commentary, Match, Score, Scorecard } from "@/types/cricket";
import type { InsightsAdvisorResponse } from "@/types/insights";
import type { LiveEdaReport, LivePressureSnapshot } from "@/types/eda";

export const LIVE_EDA_POLL_INTERVAL_SECONDS = 15;

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

  return match.teams[inningsIndex] || match.teams[0] || score.inning;
}

export function deriveLivePressureSnapshot(match: Match): LivePressureSnapshot {
  const populatedScores = match.score.filter((score) => score.r > 0 || score.w > 0 || score.o > 0);
  const currentScore = populatedScores[populatedScores.length - 1];

  if (!currentScore) {
    throw new Error("This match has not started scoring yet.");
  }

  const scheduledOvers = getScheduledOvers(match.matchType);
  const innings = Math.min(2, populatedScores.length);
  const battingTeam = inferBattingTeam(currentScore, match, innings - 1);
  const bowlingTeam = match.teams.find((team) => team !== battingTeam) || "";
  const target = innings === 2 && populatedScores[0] ? populatedScores[0].r + 1 : null;
  const currentRunRate = currentScore.o > 0 ? round(currentScore.r / currentScore.o, 2) : 0;
  const oversRemaining =
    scheduledOvers !== null ? Math.max(round(scheduledOvers - currentScore.o, 1), 0) : null;
  const requiredRunRate =
    innings === 2 && target && scheduledOvers !== null
      ? round(Math.max(0, target - currentScore.r) / Math.max(scheduledOvers - currentScore.o, 0.1), 2)
      : null;
  const wicketPenalty = innings === 1 ? currentScore.w * 4.5 : currentScore.w * 5;
  const projectedTotal =
    scheduledOvers !== null
      ? clamp(
          round(
            currentScore.r +
              Math.max(0, scheduledOvers - currentScore.o) *
                Math.max(4.2, currentRunRate - wicketPenalty / Math.max(scheduledOvers, 1)),
            0
          ),
          currentScore.r,
          scheduledOvers === 50 ? 450 : scheduledOvers === 20 ? 260 : 180
        )
      : currentScore.r;
  const pressureIndex = clamp(
    innings === 2 && requiredRunRate !== null
      ? 45 +
          (requiredRunRate - currentRunRate) * 8 +
          currentScore.w * 2.5 +
          (oversRemaining !== null && oversRemaining <= 5 ? 6 : 0)
      : scheduledOvers !== null
        ? 30 + currentScore.w * 3 + Math.max(0, currentScore.o - scheduledOvers * 0.7) * 2
        : 25 + currentScore.w * 4,
    0,
    100
  );
  const momentumIndex = clamp(
    innings === 2 && requiredRunRate !== null
      ? 55 + (currentRunRate - requiredRunRate) * 10 - currentScore.w * 1.5
      : scheduledOvers !== null
        ? 50 + (currentRunRate - (scheduledOvers === 50 ? 5.8 : scheduledOvers === 10 ? 9.5 : 8)) * 8 - currentScore.w
        : 50 - currentScore.w,
    0,
    100
  );

  return {
    innings,
    battingTeam,
    bowlingTeam,
    runs: currentScore.r,
    wickets: currentScore.w,
    wicketsInHand: Math.max(0, 10 - currentScore.w),
    overs: currentScore.o,
    target,
    currentRunRate,
    requiredRunRate,
    projectedTotal,
    ballsRemaining: scheduledOvers !== null ? Math.max(scheduledOvers * 6 - Math.round(currentScore.o * 6), 0) : null,
    pressureIndex: round(pressureIndex, 1),
    momentumIndex: round(momentumIndex, 1),
    phase: inferPhase(currentScore.o, match.matchType),
  };
}

async function getAdvisor(match: Match, snapshot: LivePressureSnapshot): Promise<InsightsAdvisorResponse | null> {
  if (!isT20Match(match)) {
    return null;
  }

  try {
    const upstream = await forwardInsightsService("/t20-insights/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runs: snapshot.runs,
        wickets: snapshot.wickets,
        overs: snapshot.overs,
        innings: snapshot.innings,
        target: snapshot.target,
        batting_team: snapshot.battingTeam,
        bowling_team: snapshot.bowlingTeam,
        match_gender: inferMatchGender(match),
        strategy: "balanced",
        top_n: 5,
      }),
    });

    if (!upstream.ok) {
      return null;
    }

    return JSON.parse(upstream.body) as InsightsAdvisorResponse;
  } catch {
    return null;
  }
}

type BuildLiveEdaReportOptions = {
  commentary?: Commentary | null;
  scorecards?: Scorecard[] | null;
  fresh?: boolean;
};

export async function buildLiveEdaReport(
  match: Match,
  options: BuildLiveEdaReportOptions = {}
): Promise<LiveEdaReport> {
  const snapshot = deriveLivePressureSnapshot(match);
  const scheduledOvers = getScheduledOvers(match.matchType);
  const [venue, advisor, commentary, scorecards] = await Promise.all([
    getVenueSnapshot(match.venue, match.matchType),
    getAdvisor(match, snapshot),
    options.commentary !== undefined ? Promise.resolve(options.commentary) : getMatchCommentary(match.id, { fresh: options.fresh ?? true }),
    options.scorecards !== undefined ? Promise.resolve(options.scorecards) : getMatchScorecard(match.id, { fresh: options.fresh ?? true }),
  ]);
  const analytics = buildLiveAnalyticsBundle({
    match,
    commentaryBalls: commentary?.bbb ?? [],
    scorecards,
    snapshot,
    venue,
  });
  const topTurningBall = analytics.topTurningBalls[0];

  const cards = [
    {
      id: "current-rate",
      label: "Current run rate",
      value: `${snapshot.currentRunRate}`,
      insight: `${snapshot.battingTeam} are scoring at ${snapshot.currentRunRate} runs per over in the ${snapshot.phase.toLowerCase()}.`,
      tone: snapshot.currentRunRate >= 8 ? "good" as const : "neutral" as const,
    },
    {
      id: "pressure-index",
      label: "Pressure index",
      value: `${snapshot.pressureIndex}`,
      insight:
        snapshot.pressureIndex >= 65
          ? "The batting side is under strong scoreboard pressure."
          : "The current state is manageable, but one wicket can swing the pressure quickly.",
      tone: snapshot.pressureIndex >= 65 ? "warning" as const : "neutral" as const,
    },
    {
      id: "momentum-index",
      label: "Momentum",
      value: `${snapshot.momentumIndex}`,
      insight:
        snapshot.momentumIndex >= 55
          ? `${snapshot.battingTeam} hold the tempo edge in the current state.`
          : `${snapshot.bowlingTeam || "The fielding side"} have enough control to keep this state live.`,
      tone: snapshot.momentumIndex >= 55 ? "good" as const : "neutral" as const,
    },
    {
      id: "projection",
      label:
        scheduledOvers === null
          ? "Current total"
          : snapshot.innings === 1
            ? "Projected total"
            : "Projected finish",
      value: `${snapshot.projectedTotal}`,
      insight:
        scheduledOvers === null
          ? "This format does not have a fixed-overs projection, so the live report stays anchored to the current score state."
          : snapshot.innings === 1
            ? `A simple tempo-plus-wickets projection puts the innings around ${snapshot.projectedTotal}.`
            : `The chase trajectory currently points to roughly ${snapshot.projectedTotal} if the same tempo holds.`,
      tone: "neutral" as const,
    },
    {
      id: "required-rate",
      label: "Required run rate",
      value: snapshot.requiredRunRate !== null ? `${snapshot.requiredRunRate}` : "NA",
      insight:
        snapshot.requiredRunRate !== null
          ? `The chase still needs ${snapshot.requiredRunRate} runs per over.`
          : "Required rate applies once a chase is underway.",
      tone:
        snapshot.requiredRunRate !== null && snapshot.requiredRunRate > snapshot.currentRunRate + 1.2
          ? "warning" as const
          : "neutral" as const,
    },
    {
      id: "venue-par",
      label: "Venue first-innings par",
      value: venue.avgFirstInningsScore !== null ? `${venue.avgFirstInningsScore}` : "Waiting",
      insight: venue.summary,
      tone: venue.avgFirstInningsScore !== null ? "good" as const : "neutral" as const,
    },
  ];

  const warnings: string[] = [];
  if (!advisor && isT20Match(match)) {
    warnings.push("The specialist T20 advisor was unavailable, so this live report is using deterministic analytics only.");
  }
  if (!venue.available) {
    warnings.push("Venue benchmark history is limited in the warehouse, so context is based mainly on the live score state.");
  }
  if (scheduledOvers === null) {
    warnings.push("This format does not use a fixed-over pace model, so projections and phase labels are more conservative.");
  }
  if ((commentary?.bbb.length ?? 0) === 0) {
    warnings.push("Ball-by-ball feed is unavailable right now, so advanced live charts are waiting on the SportMonks balls stream.");
  }
  if (!scorecards || scorecards.length === 0) {
    warnings.push("Live scorecards are limited, so batter, bowler, and partnership impact views may be lighter than usual.");
  }

  const reasons = [
    "SportMonks live state is available for the active innings.",
    (commentary?.bbb.length ?? 0) > 0
      ? "Ball-by-ball events were available for the live analytics layer."
      : "Ball-by-ball events were unavailable for the live analytics layer.",
    advisor ? "The specialist T20 advisor responded with player recommendations." : "The specialist T20 advisor was unavailable or not applicable.",
    venue.available ? "Historical venue context was available." : "Historical venue context was limited.",
  ];

  return {
    match,
    snapshot,
    cards,
    summary:
      snapshot.innings === 2 && snapshot.requiredRunRate !== null
        ? `${snapshot.battingTeam} are ${snapshot.runs}/${snapshot.wickets} after ${snapshot.overs} overs, needing ${snapshot.requiredRunRate} per over. The current pressure index is ${snapshot.pressureIndex}${topTurningBall ? `, and the biggest recent swing came at ${topTurningBall.label}.` : "."}`
        : scheduledOvers !== null
          ? `${snapshot.battingTeam} are ${snapshot.runs}/${snapshot.wickets} after ${snapshot.overs} overs with a projected total of ${snapshot.projectedTotal}. The current pressure index is ${snapshot.pressureIndex}${topTurningBall ? `, and the sharpest state change came at ${topTurningBall.label}.` : "."}`
          : `${snapshot.battingTeam} are ${snapshot.runs}/${snapshot.wickets} after ${snapshot.overs} overs. Fixed-over projections are not applied in this format, so the live read leans on wickets, tempo, and venue context.`,
    advisor,
    pollIntervalSeconds: LIVE_EDA_POLL_INTERVAL_SECONDS,
    ballsTracked: commentary?.bbb.length ?? 0,
    analytics,
    confidence: buildConfidence(
      45 +
        (advisor ? 20 : 0) +
        (venue.available ? 10 : 0) +
        (match.matchStarted ? 10 : 0) +
        (scheduledOvers !== null ? 10 : 0) +
        ((commentary?.bbb.length ?? 0) > 0 ? 10 : 0),
      reasons
    ),
    freshness: buildFreshness({
      match,
      historicalAvailable: venue.available,
      notes: [
        `Live EDA refreshes every ${LIVE_EDA_POLL_INTERVAL_SECONDS} seconds from the SportMonks score state and commentary feed, then blends in venue benchmarks when available.`,
      ],
    }),
    warnings,
    sources: dedupeSources([
      {
        id: "live-sportmonks",
        type: "sportmonks" as const,
        title: match.name,
        note: "Live scoreboard state came from the SportMonks-backed match route.",
        updatedAt: new Date().toISOString(),
      },
      ...(commentary?.bbb.length
        ? [
            {
              id: "live-balls",
              type: "sportmonks" as const,
              title: "Ball-by-ball live feed",
              note: `${commentary.bbb.length} tracked balls were used for live timelines, turning points, heatmaps, and matchup analysis.`,
            },
          ]
        : []),
      {
        id: "live-venue",
        type: "historical_warehouse" as const,
        title: "Venue live benchmark",
        note: venue.summary,
      },
      ...(advisor
        ? [
            {
              id: "live-advisor",
              type: "application" as const,
              title: "Specialist T20 advisor",
              note: "Live player recommendations were blended into the report for T20 states.",
            },
          ]
        : []),
    ]),
  };
}
