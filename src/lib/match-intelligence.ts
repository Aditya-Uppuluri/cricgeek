import type {
  Match,
  MatchPreviewIntel,
  PostMatchEdaCard,
  PostMatchIntel,
  Scorecard,
  Squad,
} from "@/types/cricket";
import { getOllamaHeaders, getOllamaUrl, OLLAMA_REQUEST_TIMEOUT_MS } from "@/lib/ollama";

const OLLAMA_URL = getOllamaUrl();
const OLLAMA_MATCH_MODEL =
  process.env.OLLAMA_MATCH_MODEL || process.env.OLLAMA_BQS_MODEL || process.env.OLLAMA_MODEL || "qwen3.5:latest";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRunRate(runs: number, overs: number) {
  if (!overs) return "0.00";
  return (runs / overs).toFixed(2);
}

function getTopBatters(scorecards: Scorecard[]) {
  return scorecards
    .flatMap((card) =>
      card.batting.map((entry) => ({
        name: entry.batsman.name,
        runs: entry.r,
        strikeRate: Number(entry.sr),
        inning: card.inning,
      }))
    )
    .sort((left, right) => right.runs - left.runs)
    .slice(0, 3);
}

function getTopBowlers(scorecards: Scorecard[]) {
  return scorecards
    .flatMap((card) =>
      card.bowling.map((entry) => ({
        name: entry.bowler.name,
        wickets: entry.w,
        economy: Number(entry.eco),
        inning: card.inning,
      }))
    )
    .sort((left, right) => {
      if (right.wickets !== left.wickets) return right.wickets - left.wickets;
      return left.economy - right.economy;
    })
    .slice(0, 3);
}

function parseExtras(extras: string) {
  const match = extras.match(/\((\d+)\)/);
  return match ? Number(match[1]) : 0;
}

async function generateStructuredNarrative<T>(prompt: string): Promise<T | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: getOllamaHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: OLLAMA_MATCH_MODEL,
        prompt,
        format: "json",
        think: false,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 500,
        },
      }),
      signal: AbortSignal.timeout(OLLAMA_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    if (!data.response) return null;
    return JSON.parse(data.response) as T;
  } catch {
    return null;
  }
}

export async function buildMatchPreviewIntel(match: Match, squads: Squad[] | null): Promise<MatchPreviewIntel> {
  const watchPlayers =
    squads?.flatMap((squad) => squad.players.slice(0, 2).map((player) => player.name)).slice(0, 4) ??
    [];

  const fallback: MatchPreviewIntel = {
    headline: `${match.teams[0]} vs ${match.teams[1]} preview`,
    summary: `${match.teams[0]} and ${match.teams[1]} meet in a ${match.matchType} contest at ${match.venue}. The preview focus is on matchup control, phase management, and who handles pressure better once the game speeds up.`,
    keyQuestions: [
      `Which side controls the first 6 overs in ${match.matchType} conditions?`,
      "Can the bowling unit defend middle-overs pressure without leaking boundary balls?",
      "Which batting core looks better prepared for game-state changes?",
    ],
    tacticalAngles: [
      "Watch how both sides manage strike rotation before trying to force boundary pressure.",
      "The bowling side that changes pace earliest may own the middle overs.",
      "Early field settings will hint at whether captains trust containment or wicket-taking lines.",
    ],
    watchPlayers,
    predictedPressurePhase: "Middle overs",
  };

  const narrative = await generateStructuredNarrative<Partial<MatchPreviewIntel>>(
    `You are a cricket analyst writing a sharp pre-match preview. Return strict JSON.
Keys: headline, summary, keyQuestions, tacticalAngles, watchPlayers, predictedPressurePhase.
Match: ${match.name}
Type: ${match.matchType}
Venue: ${match.venue}
Status: ${match.status}
Players to consider: ${watchPlayers.join(", ") || "Not supplied"}`
  );

  return {
    headline: narrative?.headline || fallback.headline,
    summary: narrative?.summary || fallback.summary,
    keyQuestions: Array.isArray(narrative?.keyQuestions) && narrative.keyQuestions.length > 0
      ? narrative.keyQuestions.slice(0, 3)
      : fallback.keyQuestions,
    tacticalAngles: Array.isArray(narrative?.tacticalAngles) && narrative.tacticalAngles.length > 0
      ? narrative.tacticalAngles.slice(0, 3)
      : fallback.tacticalAngles,
    watchPlayers: Array.isArray(narrative?.watchPlayers) && narrative.watchPlayers.length > 0
      ? narrative.watchPlayers.slice(0, 4)
      : fallback.watchPlayers,
    predictedPressurePhase: narrative?.predictedPressurePhase || fallback.predictedPressurePhase,
  };
}

export async function buildPostMatchIntel(match: Match, scorecards: Scorecard[] | null): Promise<PostMatchIntel> {
  const cards = buildPostMatchEdaCards(scorecards ?? []);
  const topBatters = getTopBatters(scorecards ?? []);
  const topBowlers = getTopBowlers(scorecards ?? []);

  const fallback: PostMatchIntel = {
    headline: `${match.name} post-match analysis`,
    summary: `The result at ${match.venue} was shaped by phase control, scoring efficiency, and who handled key pressure windows better. The EDA cards below break down where the match tilted.`,
    turningPoints: [
      "Boundary control in the decisive phase created the scoreboard gap.",
      "The side that handled dot-ball pressure better also dictated the field placements.",
      "Bowling discipline, not just wicket count, defined the finish.",
    ],
    tacticalTakeaways: [
      "Strike rotation and run-rate stability mattered more than isolated big overs.",
      "Bowling sides that held length under pressure gave away fewer release balls.",
      "The match reward went to the team with the cleaner middle-overs plan.",
    ],
    standoutPerformers: [
      ...topBatters.map((entry) => `${entry.name}: ${entry.runs} runs in ${entry.inning}`),
      ...topBowlers.map((entry) => `${entry.name}: ${entry.wickets} wickets in ${entry.inning}`),
    ].slice(0, 4),
    edaCards: cards,
  };

  const narrative = await generateStructuredNarrative<Partial<PostMatchIntel>>(
    `You are a cricket analyst writing concise post-match insight. Return strict JSON.
Keys: headline, summary, turningPoints, tacticalTakeaways, standoutPerformers.
Match: ${match.name}
Venue: ${match.venue}
Status: ${match.status}
EDA summary: ${cards.map((card) => `${card.label}: ${card.value} (${card.insight})`).join("; ")}`
  );

  return {
    headline: narrative?.headline || fallback.headline,
    summary: narrative?.summary || fallback.summary,
    turningPoints: Array.isArray(narrative?.turningPoints) && narrative.turningPoints.length > 0
      ? narrative.turningPoints.slice(0, 3)
      : fallback.turningPoints,
    tacticalTakeaways: Array.isArray(narrative?.tacticalTakeaways) && narrative.tacticalTakeaways.length > 0
      ? narrative.tacticalTakeaways.slice(0, 3)
      : fallback.tacticalTakeaways,
    standoutPerformers: Array.isArray(narrative?.standoutPerformers) && narrative.standoutPerformers.length > 0
      ? narrative.standoutPerformers.slice(0, 4)
      : fallback.standoutPerformers,
    edaCards: cards,
  };
}

export function buildPostMatchEdaCards(scorecards: Scorecard[]): PostMatchEdaCard[] {
  if (scorecards.length === 0) {
    return [
      {
        id: "no-scorecard",
        label: "Scorecard unavailable",
        value: "Waiting",
        insight: "Live scorecard data is required before post-match analytics can be generated.",
        tone: "warning",
      },
    ];
  }

  const totals = scorecards.map((card) => card.totalRuns);
  const runRates = scorecards.map((card) => Number(formatRunRate(card.totalRuns, card.totalOvers)));
  const extras = scorecards.map((card) => parseExtras(card.extras));
  const topBatter = getTopBatters(scorecards)[0];
  const topBowler = getTopBowlers(scorecards)[0];
  const aggregateBoundaries = scorecards.flatMap((card) => card.batting).reduce(
    (sum, entry) => sum + entry["4s"] + entry["6s"],
    0
  );

  const cards: PostMatchEdaCard[] = [
    {
      id: "top-total",
      label: "Peak innings total",
      value: `${Math.max(...totals)}`,
      insight: "Highest innings total from the scorecard set.",
      tone: "good",
    },
    {
      id: "avg-run-rate",
      label: "Average run rate",
      value: average(runRates).toFixed(2),
      insight: "Mean scoring speed across available innings.",
      tone: average(runRates) >= 8 ? "good" : "neutral",
    },
    {
      id: "top-batter",
      label: "Top batter",
      value: topBatter ? `${topBatter.name} (${topBatter.runs})` : "N/A",
      insight: topBatter ? `Best scoring contribution came in ${topBatter.inning}.` : "No batting data available.",
      tone: "good",
    },
    {
      id: "top-bowler",
      label: "Top bowler",
      value: topBowler ? `${topBowler.name} (${topBowler.wickets}w)` : "N/A",
      insight: topBowler ? `Most wickets and strongest pressure spell.` : "No bowling data available.",
      tone: "good",
    },
    {
      id: "extras",
      label: "Extras donated",
      value: `${extras.reduce((sum, value) => sum + value, 0)}`,
      insight: "Useful pressure-release indicator from the scorecards.",
      tone: extras.reduce((sum, value) => sum + value, 0) > 18 ? "warning" : "neutral",
    },
    {
      id: "boundaries",
      label: "Boundary volume",
      value: `${aggregateBoundaries}`,
      insight: "Total fours and sixes recorded in the available innings.",
      tone: aggregateBoundaries >= 30 ? "good" : "neutral",
    },
  ];

  return cards;
}
