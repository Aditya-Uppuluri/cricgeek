import { buildPostMatchIntel } from "@/lib/match-intelligence";
import { buildConfidence, buildFreshness, dedupeSources } from "@/lib/eda/common";
import {
  getHeadToHeadSnapshot,
  getTeamFormSnapshot,
  getVenueSnapshot,
} from "@/lib/eda/historical";
import type { Match, Scorecard } from "@/types/cricket";
import type { PostMatchEdaReport } from "@/types/eda";

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
      tone:
        primarySummary && venue.avgFirstInningsScore !== null && primarySummary.totalRuns >= venue.avgFirstInningsScore
          ? "good" as const
          : "neutral" as const,
    },
    {
      id: "winner-form",
      label: "Winner recent form",
      value: winnerForm?.available ? `${winnerForm.wins}-${winnerForm.losses}-${winnerForm.noResult}` : "Waiting",
      insight: winnerForm?.summary || "Winner form becomes available once the historical warehouse has comparable matches.",
      tone: winnerForm?.available ? "good" as const : "neutral" as const,
    },
    {
      id: "head-to-head-context",
      label: "Head-to-head context",
      value: headToHead.available ? `${headToHead.teamAWins}-${headToHead.teamBWins}` : "Waiting",
      insight: headToHead.summary,
      tone: headToHead.available ? "neutral" as const : "warning" as const,
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
