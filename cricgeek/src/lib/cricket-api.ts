import { Match, Scorecard, Squad, CalendarMatch, Commentary } from "@/types/cricket";
import {
  getSMCommentary,
  getSMFixture,
  getSMLivescores,
  getSMRecentResults,
  getSMScorecard,
  getSMSquads,
  getSMUpcoming,
  isSportMonksConfigured,
} from "@/lib/sportmonks";

const ALLOW_MOCK_MATCH_DATA = process.env.ALLOW_MOCK_MATCH_DATA === "true";

type MatchDataOptions = {
  fresh?: boolean;
};

export type MatchDetailBundle = {
  match: Match | null;
  scorecard: Scorecard[] | null;
  commentary: Commentary | null;
  squads: Squad[] | null;
  source: "sportmonks" | "mock" | "none";
};

function isMockMatchId(matchId: string) {
  return matchId.startsWith("mock-") || matchId.startsWith("cal-");
}

function shouldUseMockMatchData(matchId: string) {
  return ALLOW_MOCK_MATCH_DATA && isMockMatchId(matchId);
}

function dedupeMatches(matches: Match[]): Match[] {
  const seen = new Set<string>();
  const merged: Match[] = [];

  for (const match of matches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    merged.push(match);
  }

  return merged;
}

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((left, right) => {
    const leftLive = left.matchStarted && !left.matchEnded;
    const rightLive = right.matchStarted && !right.matchEnded;
    if (leftLive !== rightLive) return leftLive ? -1 : 1;

    const leftUpcoming = !left.matchStarted;
    const rightUpcoming = !right.matchStarted;
    if (leftUpcoming && rightUpcoming) {
      return new Date(left.dateTimeGMT || left.date).getTime() - new Date(right.dateTimeGMT || right.date).getTime();
    }

    if (left.matchEnded && right.matchEnded) {
      return new Date(right.dateTimeGMT || right.date).getTime() - new Date(left.dateTimeGMT || left.date).getTime();
    }

    return new Date(left.dateTimeGMT || left.date).getTime() - new Date(right.dateTimeGMT || right.date).getTime();
  });
}

export async function getLiveMatchesWithSource(): Promise<{ matches: Match[]; source: "sportmonks" | "mock" | "none" }> {
  if (isSportMonksConfigured()) {
    const [live, upcoming, recent] = await Promise.all([
      getSMLivescores(),
      getSMUpcoming(),
      getSMRecentResults(),
    ]);

    const merged = dedupeMatches([
      ...(live ?? []),
      ...(upcoming ?? []),
      ...(recent ?? []),
    ]);

    if (merged.length > 0) {
      return {
        matches: sortMatches(merged),
        source: "sportmonks",
      };
    }
  }

  if (ALLOW_MOCK_MATCH_DATA) {
    return { matches: getMockLiveMatches(), source: "mock" };
  }

  return { matches: [], source: "none" };
}

// Get current/live matches from SportMonks.
export async function getLiveMatches(): Promise<Match[]> {
  return (await getLiveMatchesWithSource()).matches;
}


// Get match info by ID
export async function getMatchInfo(matchId: string, options: MatchDataOptions = {}): Promise<Match | null> {
  if (isSportMonksConfigured()) {
    const sportMonksMatch = await getSMFixture(matchId, options);
    if (sportMonksMatch) return sportMonksMatch;
  }

  return shouldUseMockMatchData(matchId) ? getMockMatch(matchId) : null;
}

// Get match scorecard
export async function getMatchScorecard(matchId: string, options: MatchDataOptions = {}): Promise<Scorecard[] | null> {
  if (isSportMonksConfigured()) {
    const sportMonksScorecard = await getSMScorecard(matchId, options);
    if (sportMonksScorecard && sportMonksScorecard.length > 0) {
      return sportMonksScorecard;
    }
  }

  return shouldUseMockMatchData(matchId) ? getMockScorecard() : null;
}

// Get match ball-by-ball commentary
export async function getMatchCommentary(matchId: string, options: MatchDataOptions = {}): Promise<Commentary | null> {
  if (isSportMonksConfigured()) {
    const sportMonksCommentary = await getSMCommentary(matchId, options);
    if (sportMonksCommentary && sportMonksCommentary.bbb.length > 0) {
      return sportMonksCommentary;
    }
  }

  return shouldUseMockMatchData(matchId) ? getMockCommentary() : null;
}

// Get match squads
export async function getMatchSquad(matchId: string, options: MatchDataOptions = {}): Promise<Squad[] | null> {
  if (isSportMonksConfigured()) {
    const sportMonksSquads = await getSMSquads(matchId, options);
    if (sportMonksSquads && sportMonksSquads.length > 0) {
      return sportMonksSquads;
    }
  }

  return shouldUseMockMatchData(matchId) ? getMockSquads() : null;
}

export async function getMatchDetailBundle(
  matchId: string,
  options: MatchDataOptions = {}
): Promise<MatchDetailBundle> {
  if (shouldUseMockMatchData(matchId)) {
    return {
      match: getMockMatch(matchId),
      scorecard: getMockScorecard(),
      commentary: getMockCommentary(),
      squads: getMockSquads(),
      source: "mock",
    };
  }

  if (isSportMonksConfigured()) {
    const [match, scorecard, commentary, squads] = await Promise.all([
      getSMFixture(matchId, options),
      getSMScorecard(matchId, options),
      getSMCommentary(matchId, options),
      getSMSquads(matchId, options),
    ]);

    if (match) {
      return {
        match,
        scorecard,
        commentary,
        squads,
        source: "sportmonks",
      };
    }
  }

  return {
    match: null,
    scorecard: null,
    commentary: null,
    squads: null,
    source: "none",
  };
}

// Get upcoming matches (calendar)
export async function getUpcomingMatches(): Promise<CalendarMatch[]> {
  if (isSportMonksConfigured()) {
    const upcoming = await getSMUpcoming();
    if (upcoming && upcoming.length > 0) {
      return upcoming.map((match) => ({
        id: match.id,
        name: match.name,
        matchType: match.matchType,
        date: match.date,
        dateTimeGMT: match.dateTimeGMT,
        teams: match.teams,
        teamInfo: match.teamInfo,
        venue: match.venue,
        status: match.status,
        series_id: match.series_id,
      }));
    }
  }

  return ALLOW_MOCK_MATCH_DATA ? getMockCalendarMatches() : [];
}

// Get series list
export async function getSeriesList(): Promise<unknown[]> {
  return [];
}

// ==================== MOCK DATA ====================
// Used when API key is not set or API fails

function getMockLiveMatches(): Match[] {
  return [
    {
      id: "mock-1",
      name: "India vs Australia, 3rd Test",
      matchType: "Test",
      status: "India 287/4 (78.0 ov) - Day 2",
      venue: "Melbourne Cricket Ground, Melbourne",
      date: "2026-02-11",
      dateTimeGMT: "2026-02-11T04:00:00",
      teams: ["India", "Australia"],
      teamInfo: [
        { name: "India", shortname: "IND", img: "/flags/ind.png" },
        { name: "Australia", shortname: "AUS", img: "/flags/aus.png" },
      ],
      score: [
        { r: 287, w: 4, o: 78, inning: "India 1st Innings" },
        { r: 0, w: 0, o: 0, inning: "Australia 1st Innings" },
      ],
      matchStarted: true,
      matchEnded: false,
    },
    {
      id: "mock-2",
      name: "England vs South Africa, 2nd ODI",
      matchType: "ODI",
      status: "England won by 5 wickets",
      venue: "The Oval, London",
      date: "2026-02-11",
      dateTimeGMT: "2026-02-11T10:00:00",
      teams: ["England", "South Africa"],
      teamInfo: [
        { name: "England", shortname: "ENG", img: "/flags/eng.png" },
        { name: "South Africa", shortname: "SA", img: "/flags/sa.png" },
      ],
      score: [
        { r: 312, w: 8, o: 50, inning: "South Africa" },
        { r: 315, w: 5, o: 47.3, inning: "England" },
      ],
      matchStarted: true,
      matchEnded: true,
    },
    {
      id: "mock-3",
      name: "Mumbai Indians vs Chennai Super Kings, IPL 2026",
      matchType: "T20",
      status: "MI 156/3 (16.2 ov) - Live",
      venue: "Wankhede Stadium, Mumbai",
      date: "2026-02-11",
      dateTimeGMT: "2026-02-11T14:00:00",
      teams: ["Mumbai Indians", "Chennai Super Kings"],
      teamInfo: [
        { name: "Mumbai Indians", shortname: "MI", img: "/flags/mi.png" },
        { name: "Chennai Super Kings", shortname: "CSK", img: "/flags/csk.png" },
      ],
      score: [
        { r: 189, w: 6, o: 20, inning: "Chennai Super Kings" },
        { r: 156, w: 3, o: 16.2, inning: "Mumbai Indians" },
      ],
      matchStarted: true,
      matchEnded: false,
    },
    {
      id: "mock-4",
      name: "Pakistan vs New Zealand, 1st T20I",
      matchType: "T20I",
      status: "Starts at 7:00 PM IST",
      venue: "Rawalpindi Cricket Stadium",
      date: "2026-02-12",
      dateTimeGMT: "2026-02-12T13:30:00",
      teams: ["Pakistan", "New Zealand"],
      teamInfo: [
        { name: "Pakistan", shortname: "PAK", img: "/flags/pak.png" },
        { name: "New Zealand", shortname: "NZ", img: "/flags/nz.png" },
      ],
      score: [],
      matchStarted: false,
      matchEnded: false,
    },
  ];
}

function getMockMatch(matchId: string): Match {
  const matches = getMockLiveMatches();
  return matches.find((m) => m.id === matchId) || matches[0];
}

function getMockScorecard(): Scorecard[] {
  return [
    {
      inning: "India 1st Innings",
      totalRuns: 287,
      totalWickets: 4,
      totalOvers: 78,
      extras: "b 4, lb 8, w 2, nb 1 (15)",
      batting: [
        { batsman: { id: "1", name: "Rohit Sharma" }, dismissal: "c Smith b Starc", r: 52, b: 78, "4s": 7, "6s": 1, sr: "66.67" },
        { batsman: { id: "2", name: "Yashasvi Jaiswal" }, dismissal: "lbw b Hazlewood", r: 82, b: 134, "4s": 10, "6s": 2, sr: "61.19" },
        { batsman: { id: "3", name: "Shubman Gill" }, dismissal: "c Carey b Lyon", r: 45, b: 89, "4s": 4, "6s": 0, sr: "50.56" },
        { batsman: { id: "4", name: "Virat Kohli" }, dismissal: "c Labuschagne b Starc", r: 34, b: 67, "4s": 3, "6s": 1, sr: "50.75" },
        { batsman: { id: "5", name: "KL Rahul" }, dismissal: "batting", r: 48, b: 72, "4s": 5, "6s": 0, sr: "66.67" },
        { batsman: { id: "6", name: "Ravindra Jadeja" }, dismissal: "batting", r: 12, b: 18, "4s": 1, "6s": 0, sr: "66.67" },
      ],
      bowling: [
        { bowler: { id: "10", name: "Mitchell Starc" }, o: 20, m: 3, r: 72, w: 2, eco: "3.60" },
        { bowler: { id: "11", name: "Josh Hazlewood" }, o: 18, m: 5, r: 48, w: 1, eco: "2.67" },
        { bowler: { id: "12", name: "Pat Cummins" }, o: 16, m: 2, r: 62, w: 0, eco: "3.88" },
        { bowler: { id: "13", name: "Nathan Lyon" }, o: 22, m: 4, r: 86, w: 1, eco: "3.91" },
      ],
    },
  ];
}

function getMockCommentary(): Commentary {
  return {
    bbb: [
      { id: "1", over: 78, ball: 0, score: 0, batsman: "KL Rahul", bowler: "Lyon", commentary: "End of over 78. India 287/4. KL Rahul 48*, Jadeja 12*", timestamp: "2026-02-11T09:00:00" },
      { id: "2", over: 77, ball: 6, score: 1, batsman: "Ravindra Jadeja", bowler: "Lyon", commentary: "77.6 Lyon to Jadeja, SINGLE! Pushed to mid-on for a quick single", timestamp: "2026-02-11T08:58:00" },
      { id: "3", over: 77, ball: 5, score: 0, batsman: "Ravindra Jadeja", bowler: "Lyon", commentary: "77.5 Lyon to Jadeja, no run. Defended solidly on the front foot", timestamp: "2026-02-11T08:57:00" },
      { id: "4", over: 77, ball: 4, score: 4, batsman: "Ravindra Jadeja", bowler: "Lyon", commentary: "77.4 Lyon to Jadeja, FOUR! Swept fine, beats the fielder at fine leg!", timestamp: "2026-02-11T08:56:00" },
      { id: "5", over: 77, ball: 3, score: 0, batsman: "KL Rahul", bowler: "Lyon", commentary: "77.3 Lyon to Rahul, no run. Good length ball, defended back", timestamp: "2026-02-11T08:55:00" },
      { id: "6", over: 77, ball: 2, score: 1, batsman: "KL Rahul", bowler: "Lyon", commentary: "77.2 Lyon to Rahul, SINGLE! Worked to square leg for one", timestamp: "2026-02-11T08:54:00" },
      { id: "7", over: 77, ball: 1, score: 0, batsman: "KL Rahul", bowler: "Lyon", commentary: "77.1 Lyon to Rahul, no run. Tossed up, defended to the off side", timestamp: "2026-02-11T08:53:00" },
    ],
  };
}

function getMockSquads(): Squad[] {
  return [
    {
      teamName: "India",
      shortname: "IND",
      img: "/flags/ind.png",
      players: [
        { id: "1", name: "Rohit Sharma", role: "Batsman", playerImg: "" },
        { id: "2", name: "Yashasvi Jaiswal", role: "Batsman", playerImg: "" },
        { id: "3", name: "Shubman Gill", role: "Batsman", playerImg: "" },
        { id: "4", name: "Virat Kohli", role: "Batsman", playerImg: "" },
        { id: "5", name: "KL Rahul", role: "WK-Batsman", playerImg: "" },
        { id: "6", name: "Ravindra Jadeja", role: "All-rounder", playerImg: "" },
        { id: "7", name: "R Ashwin", role: "Bowler", playerImg: "" },
        { id: "8", name: "Jasprit Bumrah", role: "Bowler", playerImg: "" },
        { id: "9", name: "Mohammed Siraj", role: "Bowler", playerImg: "" },
        { id: "10", name: "Shardul Thakur", role: "All-rounder", playerImg: "" },
        { id: "11", name: "Rishabh Pant", role: "WK-Batsman", playerImg: "" },
      ],
    },
    {
      teamName: "Australia",
      shortname: "AUS",
      img: "/flags/aus.png",
      players: [
        { id: "20", name: "Pat Cummins", role: "Bowler", playerImg: "" },
        { id: "21", name: "Steve Smith", role: "Batsman", playerImg: "" },
        { id: "22", name: "Marnus Labuschagne", role: "Batsman", playerImg: "" },
        { id: "23", name: "Usman Khawaja", role: "Batsman", playerImg: "" },
        { id: "24", name: "Mitchell Starc", role: "Bowler", playerImg: "" },
        { id: "25", name: "Josh Hazlewood", role: "Bowler", playerImg: "" },
        { id: "26", name: "Nathan Lyon", role: "Bowler", playerImg: "" },
        { id: "27", name: "Alex Carey", role: "WK-Batsman", playerImg: "" },
        { id: "28", name: "Travis Head", role: "Batsman", playerImg: "" },
        { id: "29", name: "Cameron Green", role: "All-rounder", playerImg: "" },
        { id: "30", name: "Mitchell Marsh", role: "All-rounder", playerImg: "" },
      ],
    },
  ];
}

function getMockCalendarMatches(): CalendarMatch[] {
  const today = new Date();
  const matches: CalendarMatch[] = [];
  const matchups = [
    { teams: ["India", "Australia"], type: "Test", venue: "MCG, Melbourne" },
    { teams: ["England", "South Africa"], type: "ODI", venue: "The Oval, London" },
    { teams: ["Mumbai Indians", "Chennai Super Kings"], type: "T20", venue: "Wankhede, Mumbai" },
    { teams: ["Pakistan", "New Zealand"], type: "T20I", venue: "Rawalpindi Stadium" },
    { teams: ["West Indies", "Sri Lanka"], type: "ODI", venue: "Sabina Park, Kingston" },
    { teams: ["Bangladesh", "Zimbabwe"], type: "Test", venue: "Dhaka Stadium" },
    { teams: ["Royal Challengers", "Delhi Capitals"], type: "T20", venue: "Chinnaswamy, Bangalore" },
    { teams: ["Kolkata Knight Riders", "Rajasthan Royals"], type: "T20", venue: "Eden Gardens, Kolkata" },
  ];

  for (let i = 0; i < 20; i++) {
    const matchDate = new Date(today);
    matchDate.setDate(today.getDate() + Math.floor(i * 1.5));
    const matchup = matchups[i % matchups.length];
    matches.push({
      id: `cal-${i}`,
      name: `${matchup.teams[0]} vs ${matchup.teams[1]}`,
      matchType: matchup.type,
      date: matchDate.toISOString().split("T")[0],
      dateTimeGMT: matchDate.toISOString(),
      teams: matchup.teams,
      teamInfo: [
        { name: matchup.teams[0], shortname: matchup.teams[0].slice(0, 3).toUpperCase(), img: "" },
        { name: matchup.teams[1], shortname: matchup.teams[1].slice(0, 3).toUpperCase(), img: "" },
      ],
      venue: matchup.venue,
      status: i < 2 ? "Live" : "Upcoming",
    });
  }
  return matches;
}
