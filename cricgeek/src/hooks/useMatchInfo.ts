"use client";

import { useQuery } from "@tanstack/react-query";
import type { Match } from "@/types/cricket";
import { MATCH_INFO_STALE, MATCH_INFO_GC } from "@/lib/query-client";

async function fetchMatchInfo(matchId: string): Promise<Match> {
  const res = await fetch(`/api/match-info?id=${encodeURIComponent(matchId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetches individual match details with a 12-hour stale time.
 * Match info doesn't change often after completion.
 *
 * Persisted to localStorage via QueryProvider.
 */
export function useMatchInfo(matchId: string, initialMatch?: Match) {
  return useQuery<Match>({
    queryKey: ["matchInfo", matchId],
    queryFn: () => fetchMatchInfo(matchId),
    enabled: Boolean(matchId),
    staleTime: MATCH_INFO_STALE,
    gcTime: MATCH_INFO_GC,
    initialData: initialMatch,
    initialDataUpdatedAt: initialMatch ? Date.now() : undefined,
  });
}
