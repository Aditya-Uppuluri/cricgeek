"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronRight, Radio, RefreshCw } from "lucide-react";
import type { Match, Scorecard, Commentary, Squad } from "@/types/cricket";
import ScorecardTable from "@/components/matches/ScorecardTable";
import CommentaryFeed from "@/components/matches/CommentaryFeed";
import SquadList from "@/components/matches/SquadList";
import MatchLiveCommentary from "@/components/matches/MatchLiveCommentary";
import AdSlot from "@/components/ads/AdSlot";
import { cn } from "@/lib/utils";

type Tab = "live" | "scorecard" | "commentary" | "squads" | "analysis";

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

function formatOvers(value: number) {
  if (!Number.isFinite(value)) return "0 ov";
  return `${value} ov`;
}

function getScheduledOvers(matchType: string) {
  const normalized = matchType.toLowerCase();
  if (normalized.includes("t20")) return 20;
  if (normalized.includes("odi")) return 50;
  return null;
}

function scoreMatchesTeam(score: Match["score"][number], team: Match["teamInfo"][number]) {
  const inning = score.inning.toLowerCase();
  return inning.includes(team.name.toLowerCase()) || inning.includes(team.shortname.toLowerCase());
}

function getTeamScoreRows(match: Match) {
  return match.teamInfo.map((team, index) => {
    const matchedScore =
      match.score.find((score) => scoreMatchesTeam(score, team)) ??
      match.score[index];

    return {
      team,
      score: matchedScore,
    };
  });
}

function scoreMatchesInningLabel(score: Match["score"][number] | undefined, inningLabel: string) {
  if (!score || !inningLabel) return false;
  return score.inning.toLowerCase().includes(inningLabel.toLowerCase());
}

function getPrimaryScore(scorecard: Scorecard[] | null) {
  if (!scorecard || scorecard.length === 0) return null;

  const activeInnings =
    [...scorecard]
      .reverse()
      .find((inning) => inning.batting.some((entry) => entry.dismissal === "batting")) ??
    scorecard[scorecard.length - 1];

  if (!activeInnings) return null;

  const liveBatters = activeInnings.batting.filter((entry) => entry.dismissal === "batting");
  const featuredBatters = (liveBatters.length > 0 ? liveBatters : activeInnings.batting)
    .slice(0, 2);
  const featuredBowlers = [...activeInnings.bowling]
    .sort((left, right) => {
      if (right.w !== left.w) return right.w - left.w;
      return Number(right.o) - Number(left.o);
    })
    .slice(0, 2);

  return {
    inning: activeInnings,
    runRate:
      activeInnings.totalOvers > 0
        ? (activeInnings.totalRuns / activeInnings.totalOvers).toFixed(2)
        : "0.00",
    featuredBatters,
    featuredBowlers,
  };
}

export default function MatchDetailClient({
  match,
  scorecard,
  commentary,
  squads,
  initialTab = "scorecard",
  source = "none",
}: MatchDetailClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab === "scorecard" && match.matchStarted ? "live" : initialTab
  );
  const [liveMatch, setLiveMatch] = useState(match);
  const [liveScorecard, setLiveScorecard] = useState(scorecard);
  const [liveCommentary, setLiveCommentary] = useState(commentary);
  const [liveSquads, setLiveSquads] = useState(squads);
  const [liveSource, setLiveSource] = useState(source);
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Whether the current user can start a live commentary session
  const [canStartSession, setCanStartSession] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isLive = liveMatch.matchStarted && !liveMatch.matchEnded;
  const isUpcoming = !liveMatch.matchStarted;
  const shouldAutoRefresh = isLive || isUpcoming;
  const refreshIntervalMs = isLive ? 15_000 : 60_000;

  const tabs: { id: Tab; label: string }[] = [
    { id: "live", label: isLive ? "Live" : "Match Centre" },
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

  // Check auth to know if the user can start a commentary session
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: unknown) => {
        const user = (data as { user?: { role?: string } })?.user;
        if (!user) return;
        const role = user.role ?? "user";
        setCanStartSession(role === "admin" || role === "moderator" || role === "writer" || role === "user");
      })
      .catch(() => { /* ignore — anonymous user */ });
  }, []);

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
  const primaryScore = getPrimaryScore(liveScorecard);
  const scheduledOvers = getScheduledOvers(liveMatch.matchType);
  const teamScoreRows = getTeamScoreRows(liveMatch).sort((left, right) => {
    const leftPriority = scoreMatchesInningLabel(left.score, primaryScore?.inning.inning ?? "") ? 1 : 0;
    const rightPriority = scoreMatchesInningLabel(right.score, primaryScore?.inning.inning ?? "") ? 1 : 0;
    return rightPriority - leftPriority;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Match Header */}
      <div className="mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#171a1b] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/8 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#a7a39a]">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-white/75">
              {liveMatch.matchType}
            </span>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#ff5b5b]">
                <span className="h-2 w-2 rounded-full bg-[#ff5b5b] animate-pulse" />
                Live
              </span>
            )}
            <span>{liveMatch.date}</span>
            <span className="text-white/45">•</span>
            <span>{liveMatch.venue}</span>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr,0.65fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8e887d]">
              {liveMatch.name}
            </p>
            <div className="mt-4 space-y-4">
              {teamScoreRows.map(({ team, score }, index) => (
                <div key={team.shortname} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    {team.img ? (
                      <img
                        src={team.img}
                        alt={team.shortname}
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-sm font-bold text-white/80 ring-1 ring-white/10">
                        {team.shortname}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={cn(
                        "truncate text-[18px] font-semibold tracking-tight",
                        scoreMatchesInningLabel(score, primaryScore?.inning.inning ?? "")
                          ? "text-white"
                          : "text-[#c5c0b6]"
                      )}>
                        {team.name}
                      </p>
                      <p className="mt-0.5 text-sm text-[#9b958b]">
                        {score ? score.inning : "Awaiting innings data"}
                      </p>
                    </div>
                  </div>

                  {score ? (
                    <div className="text-right">
                      <p className="text-[17px] font-bold text-white">
                        {score.r}/{score.w}
                      </p>
                      <p className="text-sm text-[#b5b0a5]">
                        ({score.o}{scheduledOvers ? `/${scheduledOvers}` : ""} ov)
                      </p>
                    </div>
                  ) : (
                    <div className="text-right text-sm text-[#8f8a80]">Yet to bat</div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-[#cbc6bc]">
              <p className="text-[22px] font-semibold leading-tight text-white">
                {liveMatch.status}
              </p>
              {primaryScore && (
                <>
                  <p className="text-[15px] text-[#b1ab9f]">
                    Current RR: <span className="font-semibold text-white">{primaryScore.runRate}</span>
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#2d5a41] bg-[#102417] px-3 py-1.5 text-sm font-medium text-[#7be090]">
                    <BarChart3 size={14} />
                    Live Snapshot Ready
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#111415] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8e887d]">
                Match Centre
              </p>
              <Link
                href={`/insights?matchId=${encodeURIComponent(liveMatch.id)}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#62b7ff] hover:text-[#8bc9ff]"
              >
                Stats view <ChevronRight size={16} />
              </Link>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="flex items-center gap-2 text-[#d0cbc1]">
                <Radio size={14} className={cn(isLive ? "text-[#ff5b5b]" : "text-[#8e887d]")} />
                <span className="font-medium">{isLive ? "Live feed active" : "Match centre synced"}</span>
              </div>
              <p className="text-[#a7a39a]">
                Source <span className="font-semibold text-white">{liveSource}</span> · Updated {lastUpdatedLabel}
              </p>
              {shouldAutoRefresh && (
                <div className="flex items-center gap-2 text-[#a7a39a]">
                  <RefreshCw size={14} className={cn(isRefreshing ? "animate-spin text-[#31d260]" : "text-[#8e887d]")} />
                  <span>{isRefreshing ? "Refreshing live feed…" : `Auto-refresh every ${Math.round(refreshIntervalMs / 1000)}s`}</span>
                </div>
              )}
              {refreshError && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200">
                  {refreshError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto border-b border-white/8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative mr-8 whitespace-nowrap border-b-2 px-1 pb-4 pt-1 text-[17px] font-semibold tracking-tight transition-colors",
              activeTab === tab.id
                ? "border-[#38a3ff] text-[#66b9ff]"
                : "border-transparent text-[#b1ab9f] hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {activeTab === "live" && primaryScore && (
            <div className="mb-6 overflow-hidden rounded-[24px] border border-white/8 bg-[#171a1b]">
              <div className="grid gap-px bg-white/8 lg:grid-cols-[1.3fr,0.9fr]">
                <div className="bg-[#171a1b] px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8e887d]">
                    Batters
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead className="text-[#8f897f]">
                        <tr>
                          <th className="pb-3 text-left font-semibold">Name</th>
                          <th className="pb-3 text-center font-semibold">R</th>
                          <th className="pb-3 text-center font-semibold">B</th>
                          <th className="pb-3 text-center font-semibold">4s</th>
                          <th className="pb-3 text-center font-semibold">6s</th>
                          <th className="pb-3 text-center font-semibold">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {primaryScore.featuredBatters.map((entry) => (
                          <tr key={entry.batsman.id} className="border-t border-white/6 text-white">
                            <td className="py-3 pr-4 font-semibold">
                              {entry.batsman.name}
                              {entry.dismissal === "batting" && <span className="ml-1 text-[#31d260]">*</span>}
                            </td>
                            <td className="py-3 text-center">{entry.r}</td>
                            <td className="py-3 text-center text-[#c3bdb2]">{entry.b}</td>
                            <td className="py-3 text-center text-[#c3bdb2]">{entry["4s"]}</td>
                            <td className="py-3 text-center text-[#c3bdb2]">{entry["6s"]}</td>
                            <td className="py-3 text-center text-[#c3bdb2]">{entry.sr}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#171a1b] px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8e887d]">
                    Bowling card
                  </p>
                  <div className="mt-4 space-y-4">
                    {primaryScore.featuredBowlers.map((entry) => (
                      <div key={entry.bowler.id} className="border-b border-white/6 pb-4 last:border-b-0 last:pb-0">
                        <p className="text-base font-semibold text-white">{entry.bowler.name}</p>
                        <p className="mt-1 text-sm text-[#c3bdb2]">
                          {entry.o} ov · {entry.m} maidens · {entry.r} runs · {entry.w} wickets
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8e887d]">
                          Economy {entry.eco}
                        </p>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[#c3bdb2]">
                      {primaryScore.inning.inning} · {primaryScore.inning.totalRuns}/{primaryScore.inning.totalWickets} ({formatOvers(primaryScore.inning.totalOvers)})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Tab */}
          {activeTab === "live" && hasScorecard && (
            <div className="space-y-4">
              {liveScorecard!.map((card, i) => (
                <ScorecardTable key={i} scorecard={card} />
              ))}
            </div>
          )}
          {activeTab === "live" && !hasScorecard && (
            <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-6 text-sm text-gray-400">
              {isUpcoming
                ? "The scorecard will appear here once the first innings begins."
                : "Live scorecard data has not landed yet from the provider. This panel will update automatically."}
            </div>
          )}
          {activeTab === "live" && (
            <div className="mt-6">
              <MatchLiveCommentary
                matchId={liveMatch.id}
                matchName={liveMatch.name}
                matchType={liveMatch.matchType}
                isLive={isLive}
                canStartSession={canStartSession}
              />
            </div>
          )}
          {activeTab === "live" && hasCommentary && (
            <div className="mt-6">
              <CommentaryFeed commentary={liveCommentary!} />
            </div>
          )}
          {activeTab === "live" && !hasCommentary && (
            <div className="mt-6 rounded-xl border border-gray-800 bg-cg-dark-2 p-6 text-sm text-gray-400">
              {isUpcoming
                ? "Ball-by-ball commentary will appear below the scorecard once the match goes live."
                : "Ball-by-ball commentary has not arrived yet. We’ll keep polling the API and place it below the scorecard here."}
            </div>
          )}

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
                ? "The full innings scorecard will appear once the first innings begins."
                : "Full scorecard data has not landed yet from the provider."}
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
          <div className="rounded-[24px] border border-white/8 bg-[#171a1b] p-5">
            <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#8e887d]">Match Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9e988d]">Type</span>
                <span className="text-white">{liveMatch.matchType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9e988d]">Date</span>
                <span className="text-white">{liveMatch.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9e988d]">Venue</span>
                <span className="text-white text-right text-xs max-w-[150px]">
                  {liveMatch.venue}
                </span>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-white/8 pt-5">
              <Link
                href={`/matches/${liveMatch.id}/preview`}
                className="block rounded-xl bg-white/[0.05] px-3 py-3 text-center text-xs font-semibold text-white hover:bg-white/[0.09]"
              >
                Match Preview Page
              </Link>
              <Link
                href={`/matches/${liveMatch.id}/analysis`}
                className="block rounded-xl bg-[#0f2a17] px-3 py-3 text-center text-xs font-semibold text-[#31d260] hover:bg-[#16361f]"
              >
                Post-Match Analysis Page
              </Link>
              <Link
                href={`/insights?matchId=${encodeURIComponent(liveMatch.id)}`}
                className="block rounded-xl bg-white/[0.05] px-3 py-3 text-center text-xs font-semibold text-white hover:bg-white/[0.09]"
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
