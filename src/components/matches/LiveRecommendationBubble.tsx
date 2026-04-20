"use client";

/**
 * LiveRecommendationBubble
 * ─────────────────────────
 * An inline, non-intrusive recommendation card that appears beside the live
 * scorecard during a T20 match.  It polls /api/insights/live-squad every
 * 30 seconds to detect wicket-fall or 4-over triggers, then fetches fresh
 * AI recommendations from /api/insights/live (with squad filtering) and
 * surfaces the top picks as an expandable card.
 *
 * Design decisions:
 *  - Only renders for live T20 matches (gated by `enabled` + `isT20`)
 *  - Self-contained polling — no changes required in MatchDetailClient state
 *  - Dismissable per trigger epoch (closes after user navigates away)
 *  - Links to /matches/[id]/analysis for the full insights view
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronRight, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface RecommendedPlayer {
  player?: string;
  name?: string;
  batter?: string;
  batsman?: string;
  expected_runs?: number;
  confidence?: number;
  uncertainty?: number;
  role?: string;
  [key: string]: unknown;
}

interface LiveSquadPayload {
  shouldTrigger: boolean;
  triggerReason: string | null;
  squad: string[];
  situation: {
    runs: number;
    wickets: number;
    overs: number;
    innings: number;
    battingTeam: string;
    bowlingTeam: string;
    lastWicketOver: number | null;
  } | null;
}

interface AdvisorPayload {
  recommendations?: RecommendedPlayer[];
  batters?: RecommendedPlayer[];
  players?: RecommendedPlayer[];
  match?: { name: string; status: string };
  sourceContext?: { battingTeam: string; innings: number; overs: number };
  squadFiltered?: boolean;
  error?: string;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface LiveRecommendationBubbleProps {
  matchId: string;
  matchType: string;
  /** Only show when the match is actually live */
  enabled: boolean;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function playerName(p: RecommendedPlayer): string {
  return String(p.player ?? p.name ?? p.batter ?? p.batsman ?? "Player");
}

function formatRuns(val: unknown): string {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function formatPct(val: unknown): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "";
  // If confidence is 0–1 scale, multiply; if already 0–100, use as-is
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

const POLL_INTERVAL_MS = 30_000; // check for triggers every 30 s
const T20_RE = /t20/i;

// ── Component ──────────────────────────────────────────────────────────────

export default function LiveRecommendationBubble({
  matchId,
  matchType,
  enabled,
  className,
}: LiveRecommendationBubbleProps) {
  const isT20 = T20_RE.test(matchType);

  // Track the over number of the last trigger so we don't repeat it
  const lastTriggerOverRef = useRef<number>(-1);
  // Track which trigger IDs the user has dismissed
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [squad, setSquad] = useState<string[]>([]);
  const [advisor, setAdvisor] = useState<AdvisorPayload | null>(null);
  const [triggerReason, setTriggerReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [triggerKey, setTriggerKey] = useState<string | null>(null); // unique per trigger

  // ── Fetch recommendations ─────────────────────────────────────────────

  const fetchRecommendations = useCallback(
    async (squadNames: string[]) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          matchId,
          strategy: "balanced",
          topN: "5",
        });
        if (squadNames.length > 0) {
          params.set("squad", squadNames.join(","));
        }
        const res = await fetch(`/api/insights/live?${params.toString()}`);
        if (!res.ok) {
          setAdvisor(null);
          return;
        }
        const data: AdvisorPayload = await res.json();
        setAdvisor(data.error ? null : data);
      } catch {
        setAdvisor(null);
      } finally {
        setLoading(false);
      }
    },
    [matchId]
  );

  // ── Polling — check for triggers every 30 s ───────────────────────────

  useEffect(() => {
    if (!enabled || !isT20) return;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          matchId,
          lastTriggerOver: String(lastTriggerOverRef.current),
        });
        const res = await fetch(
          `/api/insights/live-squad?${params.toString()}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;

        const data: LiveSquadPayload = await res.json();
        setSquad(data.squad);

        if (data.shouldTrigger && data.triggerReason) {
          const key = data.triggerReason; // unique per event
          if (!dismissed.has(key)) {
            // Advance the cursor so we don't re-trigger the same event
            const situationOver = data.situation?.lastWicketOver ??
              data.situation?.overs ??
              lastTriggerOverRef.current + 1;
            lastTriggerOverRef.current = Math.floor(situationOver);

            setTriggerReason(data.triggerReason);
            setTriggerKey(key);
            setExpanded(false); // collapsed by default until user clicks
            await fetchRecommendations(data.squad);
          }
        }
      } catch {
        // Silent — polling failures should not disturb the UI
      }
    };

    // Run immediately then on interval
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, isT20, matchId, dismissed, fetchRecommendations]);

  // ── Derived state ────────────────────────────────────────────────────

  const picks: RecommendedPlayer[] =
    advisor?.recommendations ??
    advisor?.batters ??
    advisor?.players ??
    [];

  const topPicks = picks.slice(0, 3);
  const hasData = topPicks.length > 0;
  const isVisible =
    enabled &&
    isT20 &&
    triggerKey !== null &&
    !dismissed.has(triggerKey) &&
    (loading || hasData);

  if (!isVisible) return null;

  // ── Dismiss ──────────────────────────────────────────────────────────

  const dismiss = () => {
    if (triggerKey) {
      setDismissed((prev) => new Set([...prev, triggerKey]));
    }
    setAdvisor(null);
    setTriggerKey(null);
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden transition-all duration-500",
        "border-violet-500/30 bg-gradient-to-br from-[#1a1035] via-[#130f28] to-[#0f0b22]",
        "shadow-[0_0_40px_rgba(139,92,246,0.15)]",
        className
      )}
    >
      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors z-10"
        aria-label="Dismiss recommendation"
      >
        <X size={14} />
      </button>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30">
          <Sparkles size={15} className="text-violet-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-widest">
            AI Recommendation
          </p>
          {triggerReason && (
            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
              <Zap size={10} className="text-amber-400 flex-shrink-0" />
              <span className="truncate capitalize">{triggerReason}</span>
            </p>
          )}
        </div>

        <ChevronRight
          size={14}
          className={cn(
            "text-gray-500 transition-transform duration-200 flex-shrink-0",
            expanded && "rotate-90"
          )}
        />
      </div>

      {/* Body — collapsed by default, expands on click */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-gray-500 text-xs">
              <div className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
              Analysing match state…
            </div>
          ) : (
            <>
              {/* Situation context */}
              {advisor?.sourceContext && (
                <p className="text-[11px] text-gray-500 pb-1">
                  {advisor.sourceContext.battingTeam}
                  {" · "}Innings {advisor.sourceContext.innings}
                  {" · "}Over {advisor.sourceContext.overs.toFixed(1)}
                </p>
              )}

              {/* Player picks */}
              <div className="space-y-1.5">
                {topPicks.map((pick, idx) => (
                  <div
                    key={playerName(pick)}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 border border-white/[0.06]"
                  >
                    {/* Rank */}
                    <span className="text-xs font-bold text-violet-400/70 w-4 flex-shrink-0">
                      {idx + 1}
                    </span>

                    {/* Name */}
                    <span className="flex-1 text-sm font-medium text-gray-200 truncate">
                      {playerName(pick)}
                    </span>

                    {/* Role badge */}
                    {pick.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 flex-shrink-0">
                        {String(pick.role).slice(0, 8)}
                      </span>
                    )}

                    {/* xRuns */}
                    {pick.expected_runs !== undefined && (
                      <span className="text-xs text-amber-400 font-semibold flex-shrink-0">
                        {formatRuns(pick.expected_runs)}
                        <span className="text-[10px] text-gray-600 ml-0.5">xR</span>
                      </span>
                    )}

                    {/* Confidence */}
                    {pick.confidence !== undefined && (
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        {formatPct(pick.confidence)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* CTA to full insights */}
              <Link
                href={`/matches/${matchId}/analysis?tab=insights`}
                className={cn(
                  "mt-3 flex items-center justify-between w-full",
                  "rounded-xl px-3 py-2",
                  "bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30",
                  "text-xs text-violet-300 font-medium transition-colors"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <BarChart3 size={11} />
                  Full Analysis
                </span>
                <ChevronRight size={11} />
              </Link>

              {advisor?.squadFiltered && squad.length > 0 && (
                <p className="text-[10px] text-gray-600 text-center pt-1">
                  Filtered to {squad.length} squad members
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
