"use client";

/**
 * LiveScoresTicker
 *
 * Horizontally scrolling marquee of live scores on the matches page.
 * Uses the shared useLiveMatches query — no duplicate polling.
 * Shows only live matches: team codes + score in a compact pill.
 */

import type { Match } from "@/types/cricket";
import { useLiveMatches } from "@/hooks/useLiveMatches";

function buildLabel(match: Match): string {
  const t = match.teamInfo ?? [];
  const t0 = t[0]?.shortname ?? match.teams?.[0]?.slice(0, 3) ?? "—";
  const t1 = t[1]?.shortname ?? match.teams?.[1]?.slice(0, 3) ?? "—";
  const s0 = match.score?.[0];
  const s1 = match.score?.[1];

  const fmt = (s: typeof s0) =>
    s ? `${s.r}/${s.w} (${Number(s.o).toFixed(1)})` : "";

  if (s0 && s1) return `${t0} ${fmt(s0)} | ${t1} ${fmt(s1)}`;
  if (s0) return `${t0} ${fmt(s0)} vs ${t1}`;
  return `${t0} vs ${t1}`;
}

export default function LiveScoresTicker() {
  const { data } = useLiveMatches();

  const liveMatches = (data?.matches ?? []).filter(
    (m) => m.matchStarted && !m.matchEnded
  );

  if (liveMatches.length === 0) return null;

  const source = data?.source ?? "";
  const lastUpdated = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
    : "";

  return (
    <div className="bg-cg-dark-2 border-y border-gray-800 overflow-hidden">
      <div className="flex items-center">
        {/* LIVE label */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/10 border-r border-gray-800 h-full">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-bold tracking-widest">LIVE</span>
        </div>

        {/* Scrolling ticker */}
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex gap-8 whitespace-nowrap py-2 px-4"
            style={{ animation: `ticker ${Math.max(liveMatches.length * 8, 20)}s linear infinite` }}
          >
            {/* Duplicate items for seamless loop */}
            {[...liveMatches, ...liveMatches].map((match, i) => (
              <span
                key={`${match.id}-${i}`}
                className="inline-flex items-center gap-2 text-xs text-gray-300 font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cg-green" />
                {buildLabel(match)}
              </span>
            ))}
          </div>
        </div>

        {/* Updated time */}
        {lastUpdated && (
          <div className="shrink-0 px-3 py-2 text-[10px] text-gray-600 border-l border-gray-800 hidden sm:block">
            {source === "sportmonks" ? "SportMonks" : "Live"} · {lastUpdated}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
