import { getMatchCommentary } from "@/lib/cricket-api";
import { forwardInsightsService } from "@/lib/ai-service";
import { buildPostMatchIntel } from "@/lib/match-intelligence";
import {
  buildConfidence,
  buildFreshness,
  buildMetricQuality,
  dedupeSources,
  round,
  shrinkRate,
} from "@/lib/eda/common";
import {
  getHeadToHeadSnapshot,
  getTeamFormSnapshot,
  getVenueSnapshot,
} from "@/lib/eda/historical";
import { buildLiveAnalyticsBundle } from "@/lib/eda/live-analytics";
import { deriveLivePressureSnapshot } from "@/lib/eda/live";
import type { BallByBall, Match, PostMatchEdaCard, Scorecard } from "@/types/cricket";
import type { InsightsEvaluationResponse } from "@/types/insights";
import type { LiveAnalyticsBundle, PostMatchEdaReport } from "@/types/eda";
import type { MetricUncertainty } from "@/types/metrics";

function formatMetricInterval(interval?: MetricUncertainty | null) {
  if (!interval) return undefined;
  const unit = interval.unit ?? "";
  return `${interval.label} ${interval.lower}–${interval.upper}${unit}`;
}

function buildBlendedEdge(input: {
  teamA: string;
  teamB: string;
  teamAFormWins: number;
  teamAFormResolved: number;
  teamBFormWins: number;
  teamBFormResolved: number;
  headToHeadWinsA: number;
  headToHeadWinsB: number;
}) {
  const resolved = input.headToHeadWinsA + input.headToHeadWinsB;
  const teamAFormRate = input.teamAFormResolved > 0 ? input.teamAFormWins / input.teamAFormResolved : 0.5;
  const teamBFormRate = input.teamBFormResolved > 0 ? input.teamBFormWins / input.teamBFormResolved : 0.5;
  const priorRateA = (teamAFormRate + (1 - teamBFormRate)) / 2;
  const blendedRateA = shrinkRate(input.headToHeadWinsA, resolved, priorRateA, 6);
  const blendedPct = round(blendedRateA * 100, 1);

  return {
    priorPctA: round(priorRateA * 100, 1),
    blendedPct,
    leader: blendedPct >= 52.5 ? input.teamA : blendedPct <= 47.5 ? input.teamB : "Even",
  };
}

function inferWinner(match: Match) {
  const normalizedStatus = match.status.toLowerCase();

  for (const team of match.teams) {
    if (normalizedStatus.includes(team.toLowerCase())) {
      return team;
    }
  }

  for (const team of match.teamInfo) {
    if (normalizedStatus.includes(team.shortname.toLowerCase())) {
      return team.name;
    }
  }

  return null;
}

function parseMargin(status: string) {
  const match = status.match(/won by (.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function groupOverStats(balls: BallByBall[]) {
  const map = new Map<number, { over: number; runs: number; wickets: number; legalBalls: number }>();
  for (const ball of balls) {
    const current = map.get(ball.over) ?? { over: ball.over, runs: 0, wickets: 0, legalBalls: 0 };
    current.runs += ball.score;
    current.wickets += ball.isWicket ? 1 : 0;
    current.legalBalls += ball.legalBall === false ? 0 : 1;
    map.set(ball.over, current);
  }
  return [...map.values()].sort((left, right) => left.over - right.over);
}

function phaseLabel(over: number) {
  if (over < 6) return "Powerplay";
  if (over < 16) return "Middle";
  return "Death";
}

function buildPhaseStats(balls: BallByBall[]) {
  const phases = new Map<string, { runs: number; wickets: number; legalBalls: number }>();
  for (const ball of balls) {
    const label = phaseLabel(ball.over);
    const current = phases.get(label) ?? { runs: 0, wickets: 0, legalBalls: 0 };
    current.runs += ball.score;
    current.wickets += ball.isWicket ? 1 : 0;
    current.legalBalls += ball.legalBall === false ? 0 : 1;
    phases.set(label, current);
  }

  return ["Powerplay", "Middle", "Death"].map((label) => {
    const value = phases.get(label) ?? { runs: 0, wickets: 0, legalBalls: 0 };
    return {
      label,
      runs: value.runs,
      wickets: value.wickets,
      legalBalls: value.legalBalls,
      runRate: value.legalBalls > 0 ? round((value.runs * 6) / value.legalBalls, 2) : 0,
    };
  });
}

function bestWicketCluster(balls: BallByBall[]) {
  const wicketIndexes = balls
    .filter((ball) => ball.isWicket)
    .map((ball) => ball.over * 6 + ball.ball);

  if (wicketIndexes.length === 0) {
    return null;
  }

  let best = 1;
  for (let start = 0; start < wicketIndexes.length; start += 1) {
    let count = 1;
    for (let next = start + 1; next < wicketIndexes.length; next += 1) {
      if (wicketIndexes[next] - wicketIndexes[start] <= 12) {
        count += 1;
      }
    }
    best = Math.max(best, count);
  }

  return best;
}

function buildCard(
  id: string,
  label: string,
  value: string,
  insight: string,
  options?: {
    tone?: "neutral" | "good" | "warning";
    sampleSize?: number;
    warning?: string | null;
  }
): PostMatchEdaCard {
  return {
    id,
    label,
    value,
    insight,
    tone: options?.tone ?? "neutral",
    quality: buildMetricQuality({
      sampleSize: options?.sampleSize ?? null,
      provenance: "observed",
      warning: options?.warning ?? null,
    }),
  };
}

async function getEvaluationSummary(): Promise<InsightsEvaluationResponse["summary"] | null> {
  try {
    const upstream = await forwardInsightsService("/t20-insights/evaluation?sample_situations=120");
    if (!upstream.ok) return null;
    const payload = JSON.parse(upstream.body) as InsightsEvaluationResponse;
    return payload.summary;
  } catch {
    return null;
  }
}

function buildRetrospectiveSummary(match: Match, winner: string | null, margin: string | null, topSwing: string | null) {
  if (winner && margin) {
    return `${winner} won by ${margin}. ${topSwing ? `${topSwing} was the sharpest swing in the tracked final-innings replay.` : "The scorecard and final-innings replay agree on the decisive pressure moments."}`;
  }

  if (winner) {
    return `${winner} finished on top. ${topSwing ? `${topSwing} was the clearest tracked turning point.` : "This retrospective combines the final scorecard with the tracked final-innings replay."}`;
  }

  return `${match.name} is being read through scorecard, historical benchmark, and tracked final-innings analytics.`;
}

function inningsTeamName(summaryInning: string) {
  return summaryInning.replace(/\s+Innings\s+\d+$/i, "").trim();
}

export async function buildPostMatchEdaReport(
  match: Match,
  scorecards: Scorecard[] | null
): Promise<PostMatchEdaReport> {
  const teamA = match.teams[0] || match.teamInfo[0]?.name || "Team A";
  const teamB = match.teams[1] || match.teamInfo[1]?.name || "Team B";
  const [intel, venue, headToHead, commentary, evaluationSummary] = await Promise.all([
    buildPostMatchIntel(match, scorecards),
    getVenueSnapshot(match.venue, match.matchType),
    getHeadToHeadSnapshot(teamA, teamB, match.matchType),
    getMatchCommentary(match.id, { fresh: true }),
    getEvaluationSummary(),
  ]);

  const winner = match.status.toLowerCase().includes("won") ? inferWinner(match) : null;
  const loser = winner ? [teamA, teamB].find((team) => team !== winner) || null : null;
  const margin = parseMargin(match.status);

  const [winnerForm, loserForm] = await Promise.all([
    winner ? getTeamFormSnapshot(winner, match.matchType) : Promise.resolve(null),
    loser ? getTeamFormSnapshot(loser, match.matchType) : Promise.resolve(null),
  ]);

  const blendedEdge =
    winner && loser && winnerForm && loserForm
      ? buildBlendedEdge({
          teamA,
          teamB,
          teamAFormWins: winner === teamA ? winnerForm.wins : loserForm.wins,
          teamAFormResolved:
            winner === teamA
              ? (winnerForm.resolvedMatches ?? winnerForm.wins + winnerForm.losses)
              : (loserForm.resolvedMatches ?? loserForm.wins + loserForm.losses),
          teamBFormWins: winner === teamB ? winnerForm.wins : loserForm.wins,
          teamBFormResolved:
            winner === teamB
              ? (winnerForm.resolvedMatches ?? winnerForm.wins + winnerForm.losses)
              : (loserForm.resolvedMatches ?? loserForm.wins + loserForm.losses),
          headToHeadWinsA: headToHead.teamAWins,
          headToHeadWinsB: headToHead.teamBWins,
        })
      : null;

  const primarySummary = intel.inningsSummaries[0];
  const benchmarkCards = [
    {
      id: "venue-par-gap",
      label: "Venue par gap",
      value:
        primarySummary && venue.avgFirstInningsScore !== null
          ? `${Math.round(primarySummary.totalRuns - venue.avgFirstInningsScore)}`
          : "Waiting",
      insight:
        primarySummary && venue.avgFirstInningsScore !== null
          ? `${primarySummary.inning} finished ${Math.round(primarySummary.totalRuns - venue.avgFirstInningsScore)} runs versus the warehouse venue average.`
          : venue.summary,
      subValue: formatMetricInterval(venue.avgFirstInningsInterval),
      tone:
        primarySummary && venue.avgFirstInningsScore !== null && primarySummary.totalRuns >= venue.avgFirstInningsScore
          ? "good" as const
          : "neutral" as const,
      quality: buildMetricQuality({
        sampleSize: venue.sampleSize,
        provenance: "historical",
        confidence: venue.confidence,
        warning: venue.warning,
        uncertainty: venue.avgFirstInningsInterval ?? null,
      }),
    },
    {
      id: "winner-form",
      label: "Winner recent form",
      value: winnerForm?.available ? `${winnerForm.wins}-${winnerForm.losses}-${winnerForm.noResult}` : "Waiting",
      insight: winnerForm?.summary || "Winner form becomes available once the historical warehouse has comparable matches.",
      tone: winnerForm?.available ? "good" as const : "neutral" as const,
      subValue: winnerForm?.avgRuns != null ? `Avg ${winnerForm.avgRuns} runs` : undefined,
      quality: buildMetricQuality({
        sampleSize: winnerForm?.sampleSize ?? 0,
        provenance: "historical",
        confidence: winnerForm?.confidence ?? "low",
        warning: winnerForm?.warning ?? null,
        uncertainty: winnerForm?.winPctInterval ?? null,
      }),
    },
    {
      id: "head-to-head-context",
      label: "Blended matchup edge",
      value:
        blendedEdge
          ? blendedEdge.leader === "Even"
            ? "Near even"
            : `${blendedEdge.blendedPct}% ${blendedEdge.leader}`
          : "Waiting",
      insight:
        blendedEdge
          ? `Raw meetings are ${headToHead.teamAWins}-${headToHead.teamBWins}. This card shrinks direct history back toward recent team form so thin samples do not overstate the matchup edge.`
          : headToHead.summary,
      subValue:
        blendedEdge
          ? `Raw ${headToHead.teamAWins}-${headToHead.teamBWins} · form prior ${blendedEdge.priorPctA}% ${teamA}`
          : undefined,
      tone: headToHead.available ? "neutral" as const : "warning" as const,
      quality: buildMetricQuality({
        sampleSize: headToHead.sampleSize,
        provenance: "blended",
        confidence: headToHead.confidence,
        warning: headToHead.warning,
        uncertainty: headToHead.rawWinInterval ?? null,
      }),
    },
  ];

  const retrospectiveWarnings: string[] = [];
  let retrospectiveAnalytics: LiveAnalyticsBundle | null = null;
  const ballsTracked = commentary?.bbb.length ?? 0;

  try {
    if (commentary?.bbb.length) {
      const snapshot = deriveLivePressureSnapshot(match);
      retrospectiveAnalytics = buildLiveAnalyticsBundle({
        match,
        commentaryBalls: commentary.bbb,
        scorecards,
        snapshot,
        venue,
      });
    } else {
      retrospectiveWarnings.push("Ball-by-ball commentary was unavailable, so the retrospective replay is limited to scorecard analytics.");
    }
  } catch {
    retrospectiveWarnings.push("Final-innings replay could not be reconstructed cleanly from the available live feed.");
  }

  const decisiveInnings =
    winner
      ? intel.inningsSummaries.find((summary) => inningsTeamName(summary.inning).toLowerCase() === winner.toLowerCase()) ??
        intel.inningsSummaries[intel.inningsSummaries.length - 1]
      : intel.inningsSummaries[intel.inningsSummaries.length - 1];
  const decisiveScorecard =
    decisiveInnings
      ? (scorecards ?? []).find((card) => card.inning === decisiveInnings.inning) ?? null
      : null;
  const overStats = groupOverStats(commentary?.bbb ?? []);
  const phaseStats = buildPhaseStats(commentary?.bbb ?? []);
  const topTurningBall = retrospectiveAnalytics?.topTurningBalls[0] ?? null;
  const topTurningOver = retrospectiveAnalytics?.topTurningOvers[0] ?? null;
  const bestCluster = bestWicketCluster(commentary?.bbb ?? []);
  const bestControlOver = overStats.length > 0 ? [...overStats].sort((left, right) => left.runs - right.runs)[0] : null;
  const mostExpensiveOver = overStats.length > 0 ? [...overStats].sort((left, right) => right.runs - left.runs)[0] : null;
  const anchorRuns = decisiveScorecard ? decisiveScorecard.batting.slice(0, 4).reduce((sum, entry) => sum + entry.r, 0) : 0;
  const finisherRuns = decisiveScorecard ? decisiveScorecard.batting.slice(4).reduce((sum, entry) => sum + entry.r, 0) : 0;
  const totalBattingRuns = anchorRuns + finisherRuns;
  const topBatterImpact = retrospectiveAnalytics?.batterImpact[0] ?? null;
  const topBowlerImpact = retrospectiveAnalytics?.bowlerRunsSaved[0] ?? retrospectiveAnalytics?.bowlerImpact[0] ?? null;
  const topMatchup = retrospectiveAnalytics?.matchupMatrix[0] ?? null;
  const tacticalLeak = intel.matchSignals.find((signal) => signal.id === "signal-extras");

  const matchSummaryCards: PostMatchEdaCard[] = [
    buildCard(
      "match-winner",
      "Winner",
      winner ?? "Result pending",
      winner && margin ? `${winner} closed the match by ${margin}.` : "Final result still needs confirmation from the provider feed.",
      { tone: winner ? "good" : "neutral", sampleSize: intel.inningsSummaries.length }
    ),
    buildCard(
      "match-margin",
      "Margin",
      margin ?? "Waiting",
      margin ? `Provider result margin: ${margin}.` : "Margin was not available in the provider status text.",
      { tone: margin ? "neutral" : "warning", sampleSize: 1 }
    ),
    buildCard(
      "turning-point",
      "Turning point",
      topTurningBall?.label ?? "Waiting",
      topTurningBall?.note ?? "The live replay needs tracked ball state before the biggest swing can be isolated.",
      { tone: topTurningBall ? "good" : "warning", sampleSize: ballsTracked }
    ),
  ];

  const battingCards: PostMatchEdaCard[] = [
    buildCard(
      "anchor-finisher",
      "Anchor vs finisher",
      totalBattingRuns > 0 ? `${round((anchorRuns / totalBattingRuns) * 100, 1)}% / ${round((finisherRuns / totalBattingRuns) * 100, 1)}%` : "Waiting",
      decisiveInnings
        ? `${decisiveInnings.inning} got ${anchorRuns} runs from the top four and ${finisherRuns} from No. 5 onward.`
        : "Decisive innings split becomes available once the batting card settles.",
      { tone: finisherRuns >= anchorRuns * 0.45 ? "good" : "neutral", sampleSize: decisiveScorecard?.batting.length ?? 0 }
    ),
    buildCard(
      "powerplay-rate",
      "Powerplay tempo",
      phaseStats[0].legalBalls > 0 ? `${phaseStats[0].runRate} rpo` : "Waiting",
      phaseStats[0].legalBalls > 0
        ? `Powerplay output was ${phaseStats[0].runs}/${phaseStats[0].wickets} in ${phaseStats[0].legalBalls} balls.`
        : "Tracked powerplay replay was unavailable for the final innings.",
      { tone: phaseStats[0].runRate >= 8 ? "good" : "neutral", sampleSize: phaseStats[0].legalBalls }
    ),
    buildCard(
      "pressure-batter",
      "Pressure scorer",
      topBatterImpact ? `${topBatterImpact.label} ${topBatterImpact.delta >= 0 ? "+" : ""}${topBatterImpact.delta}` : "Waiting",
      topBatterImpact ? topBatterImpact.note : "Pressure scoring becomes available once batter-level live replay is available.",
      { tone: topBatterImpact && topBatterImpact.delta > 0 ? "good" : "neutral", sampleSize: topBatterImpact?.sample ?? ballsTracked }
    ),
  ];

  const bowlingCards: PostMatchEdaCard[] = [
    buildCard(
      "control-over",
      "Control over",
      bestControlOver ? `Over ${bestControlOver.over + 1} · ${bestControlOver.runs}` : "Waiting",
      bestControlOver
        ? `The most restrictive tracked over leaked only ${bestControlOver.runs} runs and produced ${bestControlOver.wickets} wickets.`
        : "Control-over detection needs tracked live over data.",
      { tone: bestControlOver && bestControlOver.runs <= 4 ? "good" : "neutral", sampleSize: overStats.length }
    ),
    buildCard(
      "wicket-cluster",
      "Wicket cluster",
      bestCluster ? `${bestCluster} in 12 balls` : "Waiting",
      bestCluster
        ? `The sharpest wicket burst produced ${bestCluster} wickets inside a 12-ball window.`
        : "No tracked wicket cluster was available from the final-innings replay.",
      { tone: bestCluster && bestCluster >= 2 ? "good" : "neutral", sampleSize: ballsTracked }
    ),
    buildCard(
      "expensive-over",
      "Expensive over",
      mostExpensiveOver ? `Over ${mostExpensiveOver.over + 1} · ${mostExpensiveOver.runs}` : "Waiting",
      mostExpensiveOver
        ? `The most expensive tracked over leaked ${mostExpensiveOver.runs} runs and shifted the tempo visibly.`
        : "Expensive-over detection needs tracked over-level replay.",
      { tone: mostExpensiveOver && mostExpensiveOver.runs >= 15 ? "warning" : "neutral", sampleSize: overStats.length }
    ),
  ];

  const advancedCards: PostMatchEdaCard[] = [
    buildCard(
      "clutch-performer",
      "Clutch performer",
      intel.standoutPerformers[0] ?? "Waiting",
      topTurningBall
        ? `The replay's biggest swing and the scorecard leaders point to ${intel.standoutPerformers[0] ?? "the same performer"} as the clutch influence.`
        : "Clutch read combines turning points with scorecard impact once the tracked replay is available.",
      { tone: intel.standoutPerformers[0] ? "good" : "neutral", sampleSize: ballsTracked || intel.standoutPerformers.length }
    ),
    buildCard(
      "over-vs-expected",
      "Overperformance vs expected",
      topBatterImpact ? `${topBatterImpact.label} ${topBatterImpact.delta >= 0 ? "+" : ""}${topBatterImpact.delta}` : "Waiting",
      topBatterImpact
        ? `${topBatterImpact.label} outperformed the live context by ${topBatterImpact.delta} runs.`
        : topBowlerImpact
          ? `${topBowlerImpact.label} beat the live expectation by ${Math.abs(topBowlerImpact.delta)} runs saved.`
          : "Expected-vs-actual deltas need tracked live replay.",
      { tone: topBatterImpact && topBatterImpact.delta > 0 ? "good" : "neutral", sampleSize: topBatterImpact?.sample ?? topBowlerImpact?.sample ?? ballsTracked }
    ),
    buildCard(
      "tactical-leak",
      "Tactical mistake",
      tacticalLeak?.value ?? "Waiting",
      tacticalLeak?.insight ?? "Tactical leaks are derived from extras, boundary dependence, and turning-point context once the scorecard settles.",
      { tone: tacticalLeak?.tone ?? "neutral", sampleSize: tacticalLeak?.quality?.sampleSize ?? intel.inningsSummaries.length }
    ),
    buildCard(
      "matchup-win",
      "Matchup win/loss",
      topMatchup ? `${topMatchup.batter} vs ${topMatchup.bowler}` : "Waiting",
      topMatchup
        ? `${topMatchup.batter} scored ${topMatchup.runs} from ${topMatchup.balls} tracked balls against ${topMatchup.bowler}, with strike rate ${topMatchup.strikeRate}.`
        : "Tracked batter-versus-bowler matchup edges were unavailable.",
      { tone: topMatchup && topMatchup.threat >= 0 ? "good" : "neutral", sampleSize: topMatchup?.balls ?? ballsTracked }
    ),
  ];

  const recommendationReviewCards: PostMatchEdaCard[] = evaluationSummary
    ? [
        {
          id: "engine-top3",
          label: "Historical top-3 hit rate",
          value: `${evaluationSummary.top3Accuracy}%`,
          insight: "Held-out evaluation share where the actual best batting outcome appeared inside the engine's top 3 suggestions.",
          tone: evaluationSummary.top3Accuracy >= 55 ? "good" : "neutral",
          quality: buildMetricQuality({
            sampleSize: evaluationSummary.sampleSituations,
            provenance: "historical",
            confidence: evaluationSummary.confidenceTier,
            warning: evaluationSummary.warning,
            uncertainty: evaluationSummary.top3Interval ?? null,
          }),
        },
        {
          id: "engine-coverage",
          label: "Engine coverage",
          value: `${evaluationSummary.coverage}%`,
          insight: "Held-out share of situations where the engine had enough comparable data to make a scored recommendation.",
          tone: evaluationSummary.coverage >= 70 ? "good" : "neutral",
          quality: buildMetricQuality({
            sampleSize: evaluationSummary.sampleSituations,
            provenance: "historical",
            confidence: evaluationSummary.confidenceTier,
            warning: evaluationSummary.warning,
            uncertainty: evaluationSummary.coverageInterval ?? null,
          }),
        },
        {
          id: "engine-lift",
          label: "Held-out lift",
          value: `${evaluationSummary.improvementPct}%`,
          insight: "Average realized lift over the baseline on held-out batting situations from the historical artifact set.",
          tone: evaluationSummary.improvementPct > 0 ? "good" : "neutral",
          quality: buildMetricQuality({
            sampleSize: evaluationSummary.sampleSituations,
            provenance: "historical",
            confidence: evaluationSummary.confidenceTier,
            warning: evaluationSummary.warning,
          }),
        },
      ]
    : [
        buildCard(
          "engine-review-waiting",
          "Recommendation review",
          "Waiting",
          "Historical engine calibration was unavailable, so the recommendation review section is temporarily limited.",
          { tone: "warning", sampleSize: 0, warning: "Insights evaluation service was unavailable." }
        ),
      ];

  const recommendationReviewNotes = evaluationSummary
    ? [
        "This review uses the production engine's held-out historical evaluation rather than archived in-match trigger snapshots.",
        "Live trigger snapshots are not yet persisted, so match-specific replay grading is planned next.",
      ]
    : ["The evaluation service was unavailable during report generation."];

  const ratings = [
    {
      label: "Batting rating",
      score: clamp(
        55 +
          ((decisiveInnings?.runRate ?? 0) - 8) * 6 +
          ((decisiveInnings?.supportPct ?? 45) - 45) * 0.4 -
          Math.max(0, (decisiveInnings?.boundaryPct ?? 40) - 60) * 0.3,
        0,
        100
      ),
      insight: decisiveInnings
        ? `${decisiveInnings.inning} is rated on tempo, support share, and boundary dependence.`
        : "Batting rating waits for a settled innings fingerprint.",
    },
    {
      label: "Bowling rating",
      score: clamp(
        55 +
          (bestControlOver ? Math.max(0, 8 - bestControlOver.runs) * 4 : 0) +
          (bestCluster ? bestCluster * 6 : 0) -
          (mostExpensiveOver ? Math.max(0, mostExpensiveOver.runs - 12) * 2 : 0),
        0,
        100
      ),
      insight: "Bowling rating blends control-over quality, wicket clustering, and how expensive the worst leak became.",
    },
    {
      label: "Captaincy / tactics rating",
      score: clamp(
        52 +
          (topTurningOver ? 8 : 0) +
          (tacticalLeak?.tone === "warning" ? -6 : 4) +
          (topMatchup ? 6 : 0),
        0,
        100
      ),
      insight: "Tactics rating blends turning-point control, matchup wins, and pressure leaks such as extras or boundary dependence.",
    },
  ];

  const retrospectiveSummary = buildRetrospectiveSummary(
    match,
    winner,
    margin,
    topTurningBall?.label ?? topTurningOver?.label ?? null
  );

  const reasons = [
    "SportMonks scorecard data was available for the post-match read.",
    venue.available ? "Historical venue benchmarking was available." : "Historical venue benchmarking was limited.",
    headToHead.available ? "Head-to-head context was available." : "Head-to-head context was limited.",
    winnerForm?.available ? "Winner form was available in the warehouse." : "Winner form was limited in the warehouse.",
    commentary?.bbb.length ? "Final-innings ball-by-ball replay was available." : "Final-innings ball-by-ball replay was unavailable.",
  ];

  return {
    match,
    intel,
    benchmarkCards,
    retrospective: {
      summary: retrospectiveSummary,
      analytics: retrospectiveAnalytics,
      ballsTracked,
      matchSummaryCards,
      battingCards,
      bowlingCards,
      advancedCards,
      biggestSwings: [
        topTurningBall ? `${topTurningBall.label}: ${topTurningBall.note}` : "No ball-level swing was isolated from the available replay.",
        topTurningOver ? `${topTurningOver.label}: ${topTurningOver.note}` : "No over-level swing was isolated from the available replay.",
        decisiveInnings ? `${decisiveInnings.inning} ran at ${decisiveInnings.runRate} rpo with ${decisiveInnings.boundaryPct}% boundary dependence.` : "Decisive innings fingerprint was unavailable.",
      ],
      recommendationReviewCards,
      recommendationReviewNotes,
      ratings: ratings.map((rating) => ({
        ...rating,
        score: round(rating.score, 1),
      })),
      warnings: retrospectiveWarnings,
    },
    historical: {
      winnerForm,
      loserForm,
      venue,
      headToHead,
    },
    confidence: buildConfidence(
      60 +
        (intel.inningsSummaries.length > 0 ? 15 : 0) +
        (venue.available ? 10 : 0) +
        (headToHead.available ? 10 : 0) +
        (winnerForm?.available ? 5 : 0) +
        (commentary?.bbb.length ? 10 : 0),
      reasons
    ),
    freshness: buildFreshness({
      match,
      historicalAvailable: venue.available || headToHead.available || Boolean(winnerForm?.available),
      notes: [
        "Post-match EDA is deterministic first, with retrospective replay limited to tracked final-innings live data when available.",
      ],
    }),
    sources: dedupeSources([
      {
        id: "postmatch-sportmonks",
        type: "sportmonks" as const,
        title: match.name,
        note: "Post-match scorecard and summary data came from the SportMonks-backed match routes.",
      },
      {
        id: "postmatch-venue",
        type: "historical_warehouse" as const,
        title: "Venue benchmark",
        note: venue.summary,
      },
      {
        id: "postmatch-headtohead",
        type: "historical_warehouse" as const,
        title: "Head-to-head benchmark",
        note: headToHead.summary,
      },
      {
        id: "postmatch-replay",
        type: "sportmonks" as const,
        title: "Final-innings replay",
        note: commentary?.bbb.length
          ? `${commentary.bbb.length} tracked balls powered the retrospective replay charts.`
          : "Ball-by-ball replay was unavailable for this report.",
      },
      {
        id: "postmatch-engine-eval",
        type: "application" as const,
        title: "Recommendation engine evaluation",
        note: evaluationSummary
          ? `Historical top-3 hit rate ${evaluationSummary.top3Accuracy}% across ${evaluationSummary.sampleSituations} held-out situations.`
          : "Historical engine evaluation was unavailable.",
      },
    ]),
  };
}
