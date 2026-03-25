import { getLiveMatches } from "@/lib/cricket-api";
import LiveMatchCard from "@/components/matches/LiveMatchCard";
import AdSlot from "@/components/ads/AdSlot";
import { Zap, Filter } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Cricket Matches | CricGeek",
  description: "Live cricket scores, ball-by-ball updates, and full scorecards for all international and league matches.",
};

export const revalidate = 30;
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await getLiveMatches();
  const liveMatches = matches.filter((m) => m.matchStarted && !m.matchEnded);
  const completedMatches = matches.filter((m) => m.matchEnded);
  const upcomingMatches = matches.filter((m) => !m.matchStarted);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Zap className="text-cg-green" />
            Live Matches
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time scores and updates from around the cricket world
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button className="bg-cg-green text-black px-3 py-1.5 rounded-lg text-xs font-bold">
            All
          </button>
          <button className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700">
            T20
          </button>
          <button className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700">
            ODI
          </button>
          <button className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700">
            Test
          </button>
          <button className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700">
            <Filter size={14} />
          </button>
        </div>
      </div>

      {/* Live Now */}
      {liveMatches.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-bold text-white">Live Now</h2>
            <span className="text-gray-500 text-sm">({liveMatches.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      <AdSlot slot="matches-mid" format="horizontal" className="mb-8 max-w-3xl mx-auto" />

      {/* Upcoming */}
      {upcomingMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completedMatches.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Recent Results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedMatches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
