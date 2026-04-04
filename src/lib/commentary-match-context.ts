import "server-only";

import { prisma } from "@/lib/db";
import { getMatchInfo, getMatchSquad } from "@/lib/cricket-api";

export interface MatchContextPlayer {
  name: string;
  role?: string;
  team?: string;
}

export async function getCommentarySessionMatchContext(sessionId: string | null) {
  if (!sessionId) {
    return {
      keyterms: [] as string[],
      playerNames: [] as string[],
      players: [] as MatchContextPlayer[],
    };
  }

  const commentarySession = await prisma.liveCommentarySession.findUnique({
    where: { id: sessionId },
    select: {
      matchId: true,
      matchName: true,
      matchType: true,
    },
  });

  if (!commentarySession) {
    return {
      keyterms: [] as string[],
      playerNames: [] as string[],
      players: [] as MatchContextPlayer[],
    };
  }

  const [match, squads] = await Promise.all([
    getMatchInfo(commentarySession.matchId, { fresh: true }),
    getMatchSquad(commentarySession.matchId, { fresh: true }),
  ]);

  const terms = new Set<string>();
  const playerNames = new Set<string>();
  const players: MatchContextPlayer[] = [];

  const addTerm = (value?: string | null) => {
    const term = value?.trim();
    if (term) {
      terms.add(term);
    }
  };

  addTerm(commentarySession.matchName);
  addTerm(commentarySession.matchType);

  for (const team of match?.teams ?? []) {
    addTerm(team);
  }

  for (const teamInfo of match?.teamInfo ?? []) {
    addTerm(teamInfo.name);
    addTerm(teamInfo.shortname);
  }

  for (const squad of squads ?? []) {
    addTerm(squad.teamName);
    addTerm(squad.shortname);

    for (const player of squad.players) {
      const name = player.name?.trim();
      if (!name) continue;
      addTerm(name);
      playerNames.add(name);

      // Normalise the role label so Qwen gets consistent terms
      const rawRole = player.role?.trim() || "";
      const normalisedRole = normalisePlayerRole(rawRole);

      players.push({
        name,
        role: normalisedRole || undefined,
        team: squad.teamName || undefined,
      });
    }
  }

  return {
    keyterms: [...terms],
    playerNames: [...playerNames],
    players,
  };
}

/**
 * Map SportMonks / CricAPI role strings into clean labels Qwen can use.
 * e.g. "Bowling Allrounder" → "All-rounder (Bowler)"
 */
function normalisePlayerRole(raw: string): string {
  const lower = raw.toLowerCase();
  if (!lower) return "";

  if (lower.includes("wk") || lower.includes("wicket")) {
    if (lower.includes("bat")) return "Wicket-keeper Batter";
    return "Wicket-keeper";
  }
  if (lower.includes("allround") || lower.includes("all-round") || lower.includes("all round")) {
    if (lower.includes("bowl")) return "All-rounder (Bowler)";
    if (lower.includes("bat")) return "All-rounder (Batter)";
    return "All-rounder";
  }
  if (lower.includes("bowl")) return "Bowler";
  if (lower.includes("bat")) return "Batter";
  return raw; // return as-is if unrecognised
}
