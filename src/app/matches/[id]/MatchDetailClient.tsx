"use client";

import { useState } from "react";
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
}

export default function MatchDetailClient({
  match,
  scorecard,
  commentary,
  squads,
  initialTab = "scorecard",
}: MatchDetailClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
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
                    Match previews now have a dedicated intelligence page with tactical
                    questions, pressure forecasts, linked commentary, and match-linked
                    blogs. Use it before the first ball to get the full context.
                  </p>
                  <div className="bg-cg-green/5 border border-cg-green/20 rounded-lg p-4">
                    <p className="text-cg-green text-xs font-bold uppercase mb-1">
                      Preview Centre
                    </p>
                    <p className="text-gray-300 text-sm">
                      {match.venue} — open the preview page for tactical angles,
                      matchup questions, and squad-based watchlists.
                    </p>
                    <Link
                      href={`/matches/${match.id}/preview`}
                      className="mt-3 inline-flex rounded-lg bg-cg-green px-3 py-2 text-xs font-bold text-black hover:bg-cg-green-dark"
                    >
                      Open Match Preview
                    </Link>
                  </div>
                </div>
              </div>
              <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">
                  Post-Match Analysis
                </h3>
                <p className="text-gray-400 text-sm">
                  Post-match analysis now includes scorecard-derived EDA cards,
                  standout performers, turning points, and tactical takeaways.
                </p>
                <Link
                  href={`/matches/${match.id}/analysis`}
                  className="mt-4 inline-flex rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
                >
                  Open Post-Match Analysis
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
            <div className="mt-4 space-y-2 border-t border-gray-800 pt-4">
              <Link
                href={`/matches/${match.id}/preview`}
                className="block rounded-lg bg-white/5 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-white/10"
              >
                Match Preview Page
              </Link>
              <Link
                href={`/matches/${match.id}/analysis`}
                className="block rounded-lg bg-cg-green/10 px-3 py-2 text-center text-xs font-semibold text-cg-green hover:bg-cg-green/20"
              >
                Post-Match Analysis Page
              </Link>
            </div>
          </div>
          <AdSlot slot="match-sidebar" format="rectangle" />
        </div>
      </div>
    </div>
  );
}
