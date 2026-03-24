"use client";

import { useQuery } from "@tanstack/react-query";
import type { Match } from "@/types/cricket";
import { LIVE_REFETCH_INTERVAL } from "@/lib/query-client";

export interface LiveScoresPayload {
  ok: boolean;
  source: string;
  count: number;
  updatedAt: string;
  matches: Match[];
}

async function fetchLiveScores(): Promise<LiveScoresPayload> {
  const res = await fetch("/api/livescores", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: LiveScoresPayload = await res.json();
  if (!json.ok) throw new Error("API returned error");
  return json;
}

/**
 * Polls /api/livescores every 15 seconds.
 * Pass `initialMatches` (from SSR) to populate the cache immediately
 * so the UI never flickers on first render.
 *
 * NOT persisted to localStorage — live data must always be fresh.
 */
export function useLiveMatches(initialMatches?: Match[]) {
  const initialData: LiveScoresPayload | undefined = initialMatches?.length
    ? {
        ok: true,
        source: "ssr",
        count: initialMatches.length,
        updatedAt: new Date().toISOString(),
        matches: initialMatches,
      }
    : undefined;

  return useQuery<LiveScoresPayload>({
    queryKey: ["liveMatches"],
    queryFn: fetchLiveScores,
    staleTime: 0,              // always consider stale → always refetch on mount
    gcTime: 0,                 // don't persist in memory beyond active subscribers
    refetchInterval: LIVE_REFETCH_INTERVAL,
    refetchIntervalInBackground: false, // pause polling when tab is hidden
    initialData,
    initialDataUpdatedAt: Date.now(),
  });
}
