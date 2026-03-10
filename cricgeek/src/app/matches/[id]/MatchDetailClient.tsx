"use client";

import { useState } from "react";
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
}

export default function MatchDetailClient({
  match,
  scorecard,
  commentary,
  squads,
}: MatchDetailClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("scorecard");
  const isLive = match.matchStarted && !match.matchEnded;

  const tabs: { id: Tab; label: string }[] = [
    { id: "scorecard", label: "Scorecard" },
    { id: "commentary", label: "Commentary" },
    { id: "squads", label: "Squads" },
    { id: "analysis", label: "Analysis" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Match Header */}
      <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold bg-gray-700 text-white px-2 py-0.5 rounded">
            {match.matchType}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
          {match.name}
        </h1>
        <p className="text-gray-400 text-sm">{match.venue}</p>

        {/* Scores */}
        <div className="mt-4 space-y-2">
          {match.score?.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-white font-medium">{s.inning}</span>
              <span className="text-cg-green font-bold text-lg">
                {s.r}/{s.w} ({s.o} ov)
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-cg-green font-medium text-sm">{match.status}</p>
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
          {activeTab === "scorecard" && scorecard && (
            <div className="space-y-4">
              {scorecard.map((card, i) => (
                <ScorecardTable key={i} scorecard={card} />
              ))}
            </div>
          )}

          {/* Commentary Tab */}
          {activeTab === "commentary" && commentary && (
            <CommentaryFeed commentary={commentary} />
          )}

          {/* Squads Tab */}
          {activeTab === "squads" && squads && <SquadList squads={squads} />}

          {/* Analysis Tab */}
          {activeTab === "analysis" && (
            <div className="space-y-6">
              <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">
                  Pre-Match Analysis
                </h3>
                <div className="text-gray-400 text-sm space-y-3">
                  <p>
                    This section will feature founder-led pre-match analysis covering
                    pitch conditions, team form, head-to-head records, and key player
                    matchups. Analysis is published before every major international and
                    IPL match.
                  </p>
                  <div className="bg-cg-green/5 border border-cg-green/20 rounded-lg p-4">
                    <p className="text-cg-green text-xs font-bold uppercase mb-1">
                      Venue Report
                    </p>
                    <p className="text-gray-300 text-sm">
                      {match.venue} — Historically this venue has favored pace bowlers
                      in the first session. Average first innings score: 285. Expect
                      some sideways movement early on with the new ball.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">
                  Post-Match Analysis
                </h3>
                <p className="text-gray-400 text-sm">
                  Post-match analysis will be available once the match concludes.
                  Expect detailed breakdowns of key moments, turning points, and
                  player performances.
                </p>
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
                <span className="text-white">{match.matchType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date</span>
                <span className="text-white">{match.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Venue</span>
                <span className="text-white text-right text-xs max-w-[150px]">
                  {match.venue}
                </span>
              </div>
            </div>
          </div>
          <AdSlot slot="match-sidebar" format="rectangle" />
        </div>
      </div>
    </div>
  );
}
