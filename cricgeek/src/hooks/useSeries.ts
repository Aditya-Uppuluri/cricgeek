"use client";

import { useQuery } from "@tanstack/react-query";

export interface SeriesItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  odi: number;
  t20: number;
  test: number;
  squads: number;
  matches: number;
}

async function fetchSeries(): Promise<SeriesItem[]> {
  const res = await fetch("/api/series");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useSeries(enabled = true) {
  return useQuery<SeriesItem[]>({
    queryKey: ["series"],
    queryFn: fetchSeries,
    enabled,
    staleTime: 60 * 60 * 1000,  // 1 hour
    gcTime:    2  * 60 * 60 * 1000,
  });
}
