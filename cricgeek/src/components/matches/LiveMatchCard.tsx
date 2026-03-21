import Link from "next/link";
import { cn, getMatchTypeColor } from "@/lib/utils";
import type { Match } from "@/types/cricket";
import { Wifi, Clock, Trophy, CalendarDays } from "lucide-react";

interface LiveMatchCardProps {
  match: Match;
}

function ScoreRow({ team, score }: { team: { name: string; shortname: string; img: string }; score?: { r: number; w: number; o: number } }) {
  // Use short code if it's a recognised abbreviation (3+ chars), else fall back to first word of name
  const displayCode = team.shortname?.length >= 2 ? team.shortname : team.name.split(" ")[0].slice(0, 3).toUpperCase();
  const showFullName = team.shortname !== team.name && team.name.length > 0;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Team colour dot */}
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ring-1 ring-white/10"
          title={team.name}
        >
          {displayCode.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <span className="text-white text-sm font-semibold block truncate">
            {showFullName ? team.name : displayCode}
          </span>
        </div>
      </div>
      {score ? (
        <span className="text-white text-sm font-bold tabular-nums ml-2 flex-shrink-0">
          {score.r}/{score.w}
          <span className="text-gray-500 text-xs font-normal ml-1">
            ({Number(score.o).toFixed(1)})
          </span>
        </span>
      ) : (
        <span className="text-gray-600 text-xs flex-shrink-0">—</span>
      )}
    </div>
  );
}

export default function LiveMatchCard({ match }: LiveMatchCardProps) {
  const isLive = match.matchStarted && !match.matchEnded;
  const isCompleted = match.matchEnded;
  const isUpcoming = !match.matchStarted;

  const t0 = match.teamInfo?.[0] ?? { name: match.teams?.[0] ?? "Team A", shortname: "T1", img: "" };
  const t1 = match.teamInfo?.[1] ?? { name: match.teams?.[1] ?? "Team B", shortname: "T2", img: "" };

  // Match runs to teams (SportMonks can have multiple innings)
  // Take latest inning per team
  const runsForTeam = (teamName: string) => {
    const matches = match.score?.filter((s) =>
      s.inning?.toLowerCase().includes(teamName.toLowerCase()) ||
      s.inning?.toLowerCase().includes(t0.name?.toLowerCase())
    );
    return matches?.[matches.length - 1];
  };

  const s0 = match.score?.[0];
  const s1 = match.score?.[1];

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={cn(
          "relative bg-cg-dark-2 border rounded-xl p-4 transition-all duration-200 group overflow-hidden",
          "hover:shadow-lg hover:shadow-green-500/5 hover:-translate-y-0.5",
          isLive
            ? "border-red-500/30 hover:border-red-500/50"
            : "border-gray-800 hover:border-cg-green/40"
        )}
      >
        {/* Live glow */}
        {isLive && (
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent pointer-events-none" />
        )}

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full text-white",
              getMatchTypeColor(match.matchType)
            )}
          >
            {match.matchType}
          </span>

          <div className="flex items-center gap-1.5">
            {isLive && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-400">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                <Trophy size={10} />
                Result
              </span>
            )}
            {isUpcoming && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-yellow-400">
                <CalendarDays size={10} />
                Upcoming
              </span>
            )}
          </div>
        </div>

        {/* Teams + Scores */}
        <div className="space-y-0.5 divide-y divide-gray-800/50">
          <ScoreRow team={t0} score={s0} />
          <ScoreRow team={t1} score={s1} />
        </div>

        {/* Status & Venue */}
        <div className="mt-3 pt-2.5 border-t border-gray-800/70 space-y-1">
          <p
            className={cn(
              "text-xs font-medium truncate",
              isLive ? "text-red-400" : "text-gray-300"
            )}
          >
            {isLive && <Wifi size={10} className="inline mr-1" />}
            {match.status}
          </p>
          {match.venue && (
            <p className="text-[10px] text-gray-600 truncate flex items-center gap-1">
              {match.venue}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
