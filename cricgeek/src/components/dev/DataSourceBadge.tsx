"use client";

/**
 * DataSourceBadge — dev only
 *
 * Floating pill that tells you exactly where the displayed data came from:
 *   🟡 Persisted   — rehydrated from localStorage on page load
 *   🔵 SSR         — injected as initialData from the server render
 *   🟢 API         — just arrived from a real network fetch
 *   ⚪ Cache       — served from React Query in-memory cache (no new fetch)
 *   🔴 Fetching…   — an API call is in flight right now
 *
 * Renders nothing in production.
 */

import { useEffect, useRef, useState } from "react";
import { useLiveMatches } from "@/hooks/useLiveMatches";

type DataOrigin = "persisted" | "ssr" | "api" | "cache" | "fetching";

const BADGE: Record<DataOrigin, { label: string; dot: string; bg: string }> = {
  fetching:  { label: "Fetching…",   dot: "bg-red-500 animate-pulse",    bg: "bg-red-500/10 border-red-500/40 text-red-300" },
  api:       { label: "Live API",    dot: "bg-green-500",                 bg: "bg-green-500/10 border-green-500/40 text-green-300" },
  ssr:       { label: "SSR",         dot: "bg-blue-400",                  bg: "bg-blue-500/10 border-blue-500/40 text-blue-300" },
  persisted: { label: "Persisted",   dot: "bg-yellow-400",                bg: "bg-yellow-500/10 border-yellow-500/40 text-yellow-300" },
  cache:     { label: "Memory Cache",dot: "bg-gray-400",                  bg: "bg-gray-700/60 border-gray-600 text-gray-300" },
};

export default function DataSourceBadge() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Badge />;
}

function Badge() {
  const { data, isFetching, dataUpdatedAt } = useLiveMatches();

  // Track whether data was available before the first network response.
  // If so, it came from localStorage persistence (or SSR initialData).
  const firstRenderHadData = useRef(data !== undefined);
  const firstFetchDone = useRef(false);
  const [origin, setOrigin] = useState<DataOrigin>(() => {
    if (!data) return "fetching";
    if (data.source === "ssr") return "ssr";
    return "persisted"; // data existed before any fetch → must be localStorage
  });

  useEffect(() => {
    if (isFetching) {
      setOrigin("fetching");
      return;
    }
    if (!data) return;

    if (!firstFetchDone.current) {
      // First resolution after mount
      firstFetchDone.current = true;
      if (firstRenderHadData.current && data.source === "ssr") {
        setOrigin("ssr");
      } else if (firstRenderHadData.current) {
        setOrigin("persisted");
      } else {
        setOrigin("api");
      }
    } else {
      // Subsequent polling responses — always from the network
      setOrigin("api");
    }
  }, [isFetching, data]);

  const badge = BADGE[origin];
  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
    : null;
  const matchCount = data?.matches?.length ?? 0;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-mono shadow-lg backdrop-blur-sm ${badge.bg}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
      <span className="font-semibold">{badge.label}</span>
      {data?.source && data.source !== "ssr" && (
        <span className="opacity-60">· {data.source}</span>
      )}
      <span className="opacity-60">· {matchCount} matches</span>
      {updatedAt && <span className="opacity-60">· {updatedAt}</span>}
    </div>
  );
}
