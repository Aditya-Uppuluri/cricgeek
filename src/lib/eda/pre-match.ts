import { buildMatchPreviewIntel } from "@/lib/match-intelligence";
import { getCricketNews } from "@/lib/news/cricket-news-service";
import { deriveCompetitionLabel, buildConfidence, buildFreshness, dedupeSources } from "@/lib/eda/common";
import {
  getHeadToHeadSnapshot,
  getPlayerTrendSnapshots,
  getTeamFormSnapshot,
  getVenueSnapshot,
} from "@/lib/eda/historical";
import type { Match, Squad } from "@/types/cricket";
import type { PreMatchEdaReport } from "@/types/eda";

export async function buildPreMatchEdaReport(match: Match, squads: Squad[] | null): Promise<PreMatchEdaReport> {
  const teamA = match.teams[0] || match.teamInfo[0]?.name || "Team A";
  const teamB = match.teams[1] || match.teamInfo[1]?.name || "Team B";

  const [intel, teamAForm, teamBForm, headToHead, venue, playerTrends, newsResult] = await Promise.all([
    buildMatchPreviewIntel(match, squads),
    getTeamFormSnapshot(teamA, match.matchType),
    getTeamFormSnapshot(teamB, match.matchType),
    getHeadToHeadSnapshot(teamA, teamB, match.matchType),
    getVenueSnapshot(match.venue, match.matchType),
    getPlayerTrendSnapshots(squads, match),
    getCricketNews({
      team: match.teams.join(" "),
      tournament: deriveCompetitionLabel(match),
      limit: 4,
    }),
  ]);

  const cards = [
    {
      id: "team-a-form",
      label: `${teamA} form`,
      value: teamAForm.available ? `${teamAForm.wins}-${teamAForm.losses}-${teamAForm.noResult}` : "Waiting",
      insight: teamAForm.summary,
      tone: teamAForm.wins >= teamAForm.losses ? "good" as const : "neutral" as const,
    },
    {
      id: "team-b-form",
      label: `${teamB} form`,
      value: teamBForm.available ? `${teamBForm.wins}-${teamBForm.losses}-${teamBForm.noResult}` : "Waiting",
      insight: teamBForm.summary,
      tone: teamBForm.wins >= teamBForm.losses ? "good" as const : "neutral" as const,
    },
    {
      id: "head-to-head",
      label: "Head-to-head",
      value: headToHead.available ? `${headToHead.teamAWins}-${headToHead.teamBWins}` : "Waiting",
      insight: headToHead.summary,
      tone: headToHead.available ? "neutral" as const : "warning" as const,
    },
    {
      id: "venue-benchmark",
      label: "Venue first innings",
      value: venue.avgFirstInningsScore !== null ? `${venue.avgFirstInningsScore}` : "Waiting",
      insight: venue.summary,
      tone: venue.avgFirstInningsScore !== null ? "good" as const : "warning" as const,
    },
    {
      id: "chase-rate",
      label: "Venue chase wins",
      value: venue.chaseWinPct !== null ? `${venue.chaseWinPct}%` : "Waiting",
      insight:
        venue.chaseWinPct !== null
          ? `${venue.venue} has seen chasing sides win ${venue.chaseWinPct}% of comparable warehouse matches.`
          : "Chase split becomes available once enough venue history has been imported.",
      tone:
        venue.chaseWinPct !== null && venue.chaseWinPct >= 55
          ? "warning" as const
          : "neutral" as const,
    },
    {
      id: "watch-players",
      label: "Tracked players",
      value: `${playerTrends.length}`,
      insight:
        playerTrends.length > 0
          ? `${playerTrends[0].name}${playerTrends.length > 1 ? ` and ${playerTrends.length - 1} more squad players` : ""} have recent warehouse form to compare against this matchup.`
          : "Lineup and warehouse history will enrich this card once enough comparable player data exists.",
      tone: playerTrends.length > 0 ? "good" as const : "neutral" as const,
    },
  ];

  const reasons = [
    "SportMonks fixture data is available for the live match shell.",
    teamAForm.available && teamBForm.available
      ? "Historical warehouse team-form snapshots were available."
      : "Historical warehouse team-form snapshots were limited.",
    venue.available ? "Venue benchmark data was available." : "Venue benchmark data was limited.",
    newsResult.articles.length > 0
      ? "Recent cricket news context was available."
      : "No live news context was available for this briefing.",
  ];

  const confidenceScore =
    45 +
    (teamAForm.available ? 10 : 0) +
    (teamBForm.available ? 10 : 0) +
    (headToHead.available ? 10 : 0) +
    (venue.available ? 10 : 0) +
    (playerTrends.length > 0 ? 5 : 0) +
    (newsResult.articles.length > 0 ? 10 : 0);

  const sources = dedupeSources([
    {
      id: "sportmonks-fixture",
      type: "sportmonks" as const,
      title: match.name,
      note: "Live fixture shell and squads came from SportMonks-backed match routes.",
      updatedAt: match.dateTimeGMT || null,
    },
    {
      id: "warehouse-team-form",
      type: "historical_warehouse" as const,
      title: "Historical team form",
      note: `${teamAForm.summary} ${teamBForm.summary}`,
    },
    {
      id: "warehouse-venue",
      type: "historical_warehouse" as const,
      title: "Venue benchmark",
      note: venue.summary,
    },
    ...newsResult.articles.map((article) => ({
      id: article.id,
      type: "news" as const,
      title: article.title,
      note: article.description || article.sourceName,
      url: article.articleUrl,
      updatedAt: article.publishedAt,
    })),
      {
        id: "llm-preview",
        type: "llm" as const,
        title: "Preview narrative",
        note: "Narrative summary generated from deterministic match, squad, and warehouse context.",
      },
      ...playerTrends.map((player) => ({
        id: `player-trend-${player.name}`,
        type: "historical_warehouse" as const,
        title: `${player.name} trend`,
        note: player.summary,
      })),
    ]);

  return {
    match,
    squads,
    summary: intel.summary,
    cards,
    keyQuestions: intel.keyQuestions,
    tacticalAngles: intel.tacticalAngles,
    watchPlayers: intel.watchPlayers,
    predictedPressurePhase: intel.predictedPressurePhase,
    historical: {
      teamForms: [teamAForm, teamBForm],
      headToHead,
      venue,
      playerTrends,
    },
    relatedNews: newsResult.articles,
    confidence: buildConfidence(confidenceScore, reasons),
    freshness: buildFreshness({
      match,
      historicalAvailable: teamAForm.available || teamBForm.available || headToHead.available || venue.available,
      newsUpdatedAt: newsResult.articles[0]?.publishedAt ?? newsResult.updatedAt ?? null,
      notes: [
        "Pre-match briefing blends SportMonks fixture context, local historical warehouse data, and recent cricket news when available.",
      ],
    }),
    sources,
  };
}
