"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match, Scorecard, Commentary, Squad } from "@/types/cricket";
import ScorecardTable from "@/components/matches/ScorecardTable";
import CommentaryFeed from "@/components/matches/CommentaryFeed";
import SquadList from "@/components/matches/SquadList";
import AdSlot from "@/components/ads/AdSlot";
import { cn } from "@/lib/utils";

type Tab = "scorecard" | "commentary" | "squads" | "analysis";

interface MatchDetailClientProps {
  match: Match;
  scorecard: Scorecard[] | null;
  commentary: Commentary | null;
  squads: Squad[] | null;
  initialTab?: Tab;
  source?: "sportmonks" | "mock" | "none";
}

type MatchLiveResponse = {
  match: Match;
  scorecard: Scorecard[] | null;
  commentary: Commentary | null;
  squads: Squad[] | null;
  source: "sportmonks" | "mock" | "none";
  fetchedAt: string;
};

export default function MatchDetailClient({
  match,
  scorecard,
  commentary,
  squads,
  initialTab = "scorecard",
  source = "none",
}: MatchDetailClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [liveMatch, setLiveMatch] = useState(match);
  const [liveScorecard, setLiveScorecard] = useState(scorecard);
  const [liveCommentary, setLiveCommentary] = useState(commentary);
  const [liveSquads, setLiveSquads] = useState(squads);
  const [liveSource, setLiveSource] = useState(source);
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isLive = liveMatch.matchStarted && !liveMatch.matchEnded;
  const isUpcoming = !liveMatch.matchStarted;
  const shouldAutoRefresh = isLive || isUpcoming;
  const refreshIntervalMs = isLive ? 15_000 : 60_000;

  const tabs: { id: Tab; label: string }[] = [
    { id: "scorecard", label: "Scorecard" },
    { id: "commentary", label: "Commentary" },
    { id: "squads", label: "Squads" },
    { id: "analysis", label: "Analysis" },
  ];

  useEffect(() => {
    setLiveMatch(match);
    setLiveScorecard(scorecard);
    setLiveCommentary(commentary);
    setLiveSquads(squads);
    setLiveSource(source);
    setRefreshError(null);
    setLastUpdated(new Date().toISOString());
  }, [commentary, match, scorecard, source, squads]);

  useEffect(() => {
    if (!shouldAutoRefresh) return;

    let cancelled = false;

    const refresh = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsRefreshing(true);

      try {
        const response = await fetch(`/api/matches/${encodeURIComponent(liveMatch.id)}/live`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Live update failed with ${response.status}`);
        }

        const payload = await response.json() as MatchLiveResponse;

        if (cancelled) return;

        setLiveMatch(payload.match);
        setLiveScorecard((current) => payload.scorecard ?? current);
        setLiveCommentary((current) => payload.commentary ?? current);
        setLiveSquads((current) => payload.squads ?? current);
        setLiveSource(payload.source);
        setLastUpdated(payload.fetchedAt);
        setRefreshError(null);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setRefreshError("Live updates are temporarily delayed.");
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    refresh();
    const interval = window.setInterval(refresh, refreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [liveMatch.id, refreshIntervalMs, shouldAutoRefresh]);

  const hasScorecard = Boolean(liveScorecard && liveScorecard.length > 0);
  const hasCommentary = Boolean(liveCommentary && liveCommentary.bbb.length > 0);
  const hasSquads = Boolean(liveSquads && liveSquads.length > 0);
  const lastUpdatedLabel = new Date(lastUpdated).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Match Header */}
      <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold bg-gray-700 text-white px-2 py-0.5 rounded">
            {liveMatch.matchType}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
          {liveMatch.name}
        </h1>
        <p className="text-gray-400 text-sm">{liveMatch.venue}</p>

        {/* Scores */}
        <div className="mt-4 space-y-2">
          {liveMatch.score?.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-white font-medium">{s.inning}</span>
              <span className="text-cg-green font-bold text-lg">
                {s.r}/{s.w} ({s.o} ov)
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-cg-green font-medium text-sm">{liveMatch.status}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span>
                Source: <span className="font-semibold text-gray-200">{liveSource}</span>
              </span>
              <span>Updated {lastUpdatedLabel}</span>
              {shouldAutoRefresh && (
                <span className={cn("font-medium", isRefreshing ? "text-cg-green" : "text-gray-400")}>
                  {isRefreshing ? "Refreshing live feed…" : `Auto-refresh every ${Math.round(refreshIntervalMs / 1000)}s`}
                </span>
              )}
            </div>
          </div>
          {refreshError && (
            <p className="mt-2 text-xs text-amber-300">{refreshError}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto bg-cg-dark-2 border border-gray-800 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-cg-green text-black"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {/* Scorecard Tab */}
          {activeTab === "scorecard" && hasScorecard && (
            <div className="space-y-4">
              {liveScorecard!.map((card, i) => (
                <ScorecardTable key={i} scorecard={card} />
              ))}
            </div>
          )}
          {activeTab === "scorecard" && !hasScorecard && (
            <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-6 text-sm text-gray-400">
              {isUpcoming
                ? "The scorecard will appear here once the first innings begins."
                : "Live scorecard data has not landed yet from the provider. This panel will update automatically."}
            </div>
          )}

          {/* Commentary Tab */}
          {activeTab === "commentary" && hasCommentary && (
            <CommentaryFeed commentary={liveCommentary!} />
          )}
          {activeTab === "commentary" && !hasCommentary && (
            <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-6 text-sm text-gray-400">
              {isUpcoming
                ? "Ball-by-ball commentary unlocks when the match goes live."
                : "Ball-by-ball commentary has not arrived yet. We’ll keep polling the API."}
            </div>
          )}

          {/* Squads Tab */}
          {activeTab === "squads" && hasSquads && <SquadList squads={liveSquads!} />}
          {activeTab === "squads" && !hasSquads && (
            <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-6 text-sm text-gray-400">
              Squad data is not available for this fixture yet.
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === "analysis" && (
            <div className="space-y-6">
              <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">
                  Pre-Match Analysis
                </h3>
                <div className="text-gray-400 text-sm space-y-3">
                  <p>
                    Match previews now have a dedicated intelligence page with tactical
                    questions, pressure forecasts, linked commentary, and match-linked
                    blogs. Use it before the first ball to get the full context.
                  </p>
                  <div className="bg-cg-green/5 border border-cg-green/20 rounded-lg p-4">
                    <p className="text-cg-green text-xs font-bold uppercase mb-1">
                      Preview Centre
                    </p>
                    <p className="text-gray-300 text-sm">
                      {liveMatch.venue} — open the preview page for tactical angles,
                      matchup questions, and squad-based watchlists.
                    </p>
                    <Link
                      href={`/matches/${liveMatch.id}/preview`}
                      className="mt-3 inline-flex rounded-lg bg-cg-green px-3 py-2 text-xs font-bold text-black hover:bg-cg-green-dark"
                    >
                      Open Match Preview
                    </Link>
                  </div>
                </div>
              </div>
              <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">
                  AI Insights
                </h3>
                <p className="text-gray-400 text-sm">
                  Open the integrated T20 decision-support view for live recommendations,
                  model evaluation, and player explorer tooling using CricGeek match context.
                </p>
                <Link
                  href={`/insights?matchId=${encodeURIComponent(liveMatch.id)}`}
                  className="mt-4 inline-flex rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
                >
                  Open AI Insights
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-bold text-white mb-3">Match Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Type</span>
                <span className="text-white">{liveMatch.matchType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date</span>
                <span className="text-white">{liveMatch.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Venue</span>
                <span className="text-white text-right text-xs max-w-[150px]">
                  {liveMatch.venue}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-gray-800 pt-4">
              <Link
                href={`/matches/${liveMatch.id}/preview`}
                className="block rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-white/10"
              >
                Match Preview Page
              </Link>
              <Link
                href={`/matches/${liveMatch.id}/analysis`}
                className="block rounded-lg bg-cg-green/10 px-3 py-2 text-center text-xs font-semibold text-cg-green hover:bg-cg-green/20"
              >
                Post-Match Analysis Page
              </Link>
              <Link
                href={`/insights?matchId=${encodeURIComponent(liveMatch.id)}`}
                className="block rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-white/10"
              >
                AI Insights Page
              </Link>
            </div>
          </div>
          <AdSlot slot="match-sidebar" format="rectangle" />
        </div>
      </div>
    </div>
  );
}
