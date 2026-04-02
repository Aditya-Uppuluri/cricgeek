import "server-only";

import { prisma } from "@/lib/db";
import { getMatchInfo, getMatchSquad } from "@/lib/cricket-api";

export async function getCommentarySessionMatchContext(sessionId: string | null) {
  if (!sessionId) {
    return {
      keyterms: [] as string[],
      playerNames: [] as string[],
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
    };
  }

  const [match, squads] = await Promise.all([
    getMatchInfo(commentarySession.matchId, { fresh: true }),
    getMatchSquad(commentarySession.matchId, { fresh: true }),
  ]);

  const terms = new Set<string>();
  const playerNames = new Set<string>();

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
    }
  }

  return {
    keyterms: [...terms],
    playerNames: [...playerNames],
  };
}
