"use client";

import { useQuery, type Query } from "@tanstack/react-query";
import type { Match } from "@/types/cricket";
import { calcSeriesStaleTime, SERIES_DURING_STALE, SERIES_GC } from "@/lib/query-client";

export interface SeriesInfo {
  id: string;
  name: string;
  startdate: string; // "YYYY-MM-DD"
  enddate: string;   // "YYYY-MM-DD"
  odi?: number;
  t20?: number;
  test?: number;
}

export interface SeriesInfoData {
  info: SeriesInfo;
  matchList: Match[];
}

async function fetchSeriesInfo(seriesId: string): Promise<SeriesInfoData> {
  const res = await fetch(`/api/series-info?id=${encodeURIComponent(seriesId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetches series metadata + match list with dynamic stale time:
 * - Before series start  → cached until start date
 * - During series        → 1 hour
 * - After series ends    → 24 hours
 *
 * Persisted to localStorage via QueryProvider.
 */
export function useSeriesInfo(seriesId: string) {
  return useQuery<SeriesInfoData>({
    queryKey: ["seriesInfo", seriesId],
    queryFn: () => fetchSeriesInfo(seriesId),
    enabled: Boolean(seriesId),

    // Dynamic stale time — re-evaluated once data is available
    staleTime: (query: Query<SeriesInfoData>) => {
      const data = query.state.data;
      if (data?.info?.startdate && data?.info?.enddate) {
        return calcSeriesStaleTime(data.info.startdate, data.info.enddate);
      }
      return SERIES_DURING_STALE; // default while first fetch hasn't resolved
    },

    gcTime: SERIES_GC,
  });
}
