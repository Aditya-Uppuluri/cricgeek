"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, getMatchTypeColor } from "@/lib/utils";
import type { CalendarMatch } from "@/types/cricket";

interface CalendarClientProps {
  matches: CalendarMatch[];
}

export default function CalendarClient({ matches }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const matchesByDate = useMemo(() => {
    const map = new Map<string, CalendarMatch[]>();
    matches.forEach((match) => {
      const dateKey = match.date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(match);
    });
    return map;
  }, [matches]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date().toISOString().split("T")[0];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Cricket Calendar</h1>
      <p className="text-gray-400 text-sm mb-8">
        Top international & league matches. Click any match to view details.
      </p>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-white">{monthName}</h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-cg-dark-2 border border-gray-800 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-800">
          {days.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-xs font-semibold text-gray-400 uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for first week offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[100px] sm:min-h-[120px] border-b border-r border-gray-800/50 bg-gray-900/30"
            />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayMatches = matchesByDate.get(dateStr) || [];
            const isToday = dateStr === today;

            return (
              <div
                key={day}
                className={cn(
                  "min-h-[100px] sm:min-h-[120px] border-b border-r border-gray-800/50 p-1.5",
                  isToday && "bg-cg-green/5"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium inline-block w-6 h-6 rounded-full text-center leading-6",
                    isToday
                      ? "bg-cg-green text-black font-bold"
                      : "text-gray-400"
                  )}
                >
                  {day}
                </span>
                <div className="space-y-1 mt-1">
                  {dayMatches.slice(0, 2).map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="block"
                    >
                      <div
                        className={cn(
                          "text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate text-white font-medium",
                          getMatchTypeColor(match.matchType)
                        )}
                        title={match.name}
                      >
                        {match.teamInfo?.[0]?.shortname || match.teams[0]?.slice(0, 3)} v{" "}
                        {match.teamInfo?.[1]?.shortname || match.teams[1]?.slice(0, 3)}
                      </div>
                    </Link>
                  ))}
                  {dayMatches.length > 2 && (
                    <span className="text-[10px] text-gray-500">
                      +{dayMatches.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming List (mobile-friendly) */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-white mb-4">Upcoming Matches</h3>
        <div className="space-y-2">
          {matches
            .filter((m) => m.date >= today)
            .slice(0, 10)
            .map((match) => (
              <Link key={match.id} href={`/matches/${match.id}`}>
                <div className="bg-cg-dark-2 border border-gray-800 rounded-lg p-3 hover:border-cg-green/50 transition-all flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded text-white shrink-0",
                      getMatchTypeColor(match.matchType)
                    )}
                  >
                    {match.matchType}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {match.name}
                    </p>
                    <p className="text-gray-500 text-xs truncate">{match.venue}</p>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{match.date}</span>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
