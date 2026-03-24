import { QueryClient } from "@tanstack/react-query";

// ─── Cache durations ──────────────────────────────────────────────────────────

export const MATCH_INFO_STALE  = 12 * 60 * 60 * 1000; // 12 hours
export const MATCH_INFO_GC     = MATCH_INFO_STALE + 5 * 60 * 1000; // +5 min buffer

export const SERIES_DURING_STALE = 60 * 60 * 1000;      // 1 hour  (series in progress)
export const SERIES_AFTER_STALE  = 24 * 60 * 60 * 1000; // 24 hours (series ended)
export const SERIES_GC           = 25 * 60 * 60 * 1000; // 25 hours

export const LIVE_REFETCH_INTERVAL = 15_000; // 15 seconds

// ─── Dynamic series stale-time ─────────────────────────────────────────────────

/**
 * Returns the stale time (ms) for a series based on its lifecycle:
 * - Before series starts  → cache until start date
 * - During series         → 1 hour
 * - After series ends     → 24 hours
 */
export function calcSeriesStaleTime(startdate: string, enddate: string): number {
  const now   = Date.now();
  const start = new Date(startdate).getTime();
  const end   = new Date(enddate).getTime();

  if (now < start)  return Math.max(start - now, 0); // wait until series begins
  if (now <= end)   return SERIES_DURING_STALE;
  return SERIES_AFTER_STALE;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false, // avoid extra API calls when tab re-gains focus
        retry: 1,
      },
    },
  });
}
