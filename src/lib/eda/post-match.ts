import { buildPostMatchIntel } from "@/lib/match-intelligence";
import { buildConfidence, buildFreshness, buildMetricQuality, dedupeSources, round, shrinkRate } from "@/lib/eda/common";
import {
  getHeadToHeadSnapshot,
  getTeamFormSnapshot,
  getVenueSnapshot,
} from "@/lib/eda/historical";
import type { Match, Scorecard } from "@/types/cricket";
import type { PostMatchEdaReport } from "@/types/eda";
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
    resolved,
    priorPctA: round(priorRateA * 100, 1),
    blendedPct,
    leader:
      blendedPct >= 52.5 ? input.teamA : blendedPct <= 47.5 ? input.teamB : "Even",
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

export async function buildPostMatchEdaReport(
  match: Match,
  scorecards: Scorecard[] | null
): Promise<PostMatchEdaReport> {
  const teamA = match.teams[0] || match.teamInfo[0]?.name || "Team A";
  const teamB = match.teams[1] || match.teamInfo[1]?.name || "Team B";
  const [intel, venue, headToHead] = await Promise.all([
    buildPostMatchIntel(match, scorecards),
    getVenueSnapshot(match.venue, match.matchType),
    getHeadToHeadSnapshot(teamA, teamB, match.matchType),
  ]);

  const winner = match.status.toLowerCase().includes("won") ? inferWinner(match) : null;
  const loser = winner ? [teamA, teamB].find((team) => team !== winner) || null : null;

  const [winnerForm, loserForm] = await Promise.all([
    winner ? getTeamFormSnapshot(winner, match.matchType) : Promise.resolve(null),
    loser ? getTeamFormSnapshot(loser, match.matchType) : Promise.resolve(null),
  ]);
  const blendedEdge =
    winner && loser && winnerForm && loserForm
      ? buildBlendedEdge({
          teamA: teamA,
          teamB: teamB,
          teamAFormWins: winner === teamA ? winnerForm.wins : loserForm.wins,
          teamAFormResolved: winner === teamA
            ? (winnerForm.resolvedMatches ?? winnerForm.wins + winnerForm.losses)
            : (loserForm.resolvedMatches ?? loserForm.wins + loserForm.losses),
          teamBFormWins: winner === teamB ? winnerForm.wins : loserForm.wins,
          teamBFormResolved: winner === teamB
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
          ? `Raw meetings are ${headToHead.teamAWins}-${headToHead.teamBWins}. This card shrinks that direct history back toward recent team form so thin samples do not overstate the matchup edge.`
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

  const reasons = [
    "SportMonks scorecard data was available for the post-match read.",
    venue.available ? "Historical venue benchmarking was available." : "Historical venue benchmarking was limited.",
    headToHead.available ? "Head-to-head context was available." : "Head-to-head context was limited.",
    winnerForm?.available ? "Winner form was available in the warehouse." : "Winner form was limited in the warehouse.",
  ];

  return {
    match,
    intel,
    benchmarkCards,
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
      (winnerForm?.available ? 5 : 0),
      reasons
    ),
    freshness: buildFreshness({
      match,
      historicalAvailable: venue.available || headToHead.available || Boolean(winnerForm?.available),
      notes: [
        "Post-match EDA is deterministic first, with the narrative layer constrained to scorecard and historical benchmark context.",
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
        id: "postmatch-llm",
        type: "llm" as const,
        title: "Post-match narrative",
        note: "Narrative summary generated from deterministic scorecard and benchmark context.",
      },
    ]),
  };
}
