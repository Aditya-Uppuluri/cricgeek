"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Mic, FileText, Radio, PenSquare } from "lucide-react";
import { cn, getMatchTypeColor } from "@/lib/utils";
import type { CalendarMatch } from "@/types/cricket";

interface LinkedCommentarySession {
  id: string;
  matchId: string;
  matchName: string;
  matchType: string;
  status: string;
  createdAt: string;
  moderator: { id: string; name: string };
  _count: { entries: number };
}

interface LinkedBlog {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  matchTag: string | null;
  author: { id: string; name: string };
}

interface CalendarMatchWithLinks extends CalendarMatch {
  commentarySessions: LinkedCommentarySession[];
  blogs: LinkedBlog[];
}

interface CalendarClientProps {
  matches: CalendarMatchWithLinks[];
  source: "sportmonks" | "mock" | "none";
}

export default function CalendarClient({ matches, source }: CalendarClientProps) {
  const today = new Date().toISOString().split("T")[0];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(
    matches.some((match) => match.date === today) ? today : matches[0]?.date ?? today
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const matchesByDate = useMemo(() => {
    const map = new Map<string, CalendarMatchWithLinks[]>();
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

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedMatches = matchesByDate.get(selectedDate) ?? [];

  const getPrimaryCommentary = (match: CalendarMatchWithLinks) =>
    match.commentarySessions.find((session) => ["live", "paused", "scheduled"].includes(session.status)) ??
    match.commentarySessions[0];

  const upcomingMatches = matches
    .filter((match) => match.date >= today)
    .slice(0, 10);

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

      {matches.length === 0 && (
        <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
          <p className="text-sm font-semibold text-amber-300">No calendar matches available right now.</p>
          <p className="mt-1 text-sm text-amber-200/80">
            {source === "sportmonks"
              ? "SportMonks returned no fixtures for the current calendar window. This usually means there are no scheduled fixtures in the requested range or the API quota has been exhausted."
              : source === "mock"
                ? "Live fixture providers are not configured on this environment, so CricGeek is waiting on mock calendar data."
                : "The configured cricket fixture provider did not return any matches for this request."}
          </p>
        </div>
      )}

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
                onClick={() => dayMatches.length > 0 && setSelectedDate(dateStr)}
                className={cn(
                  "min-h-[100px] cursor-default sm:min-h-[120px] border-b border-r border-gray-800/50 p-1.5 transition-all",
                  dayMatches.length > 0 && "cursor-pointer hover:bg-white/5",
                  isToday && "bg-cg-green/5",
                  selectedDate === dateStr && "ring-1 ring-inset ring-cg-green/40"
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
                    <div key={match.id} className="space-y-1">
                      <Link href={`/matches/${match.id}`} className="block">
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
                      <div className="flex flex-wrap gap-1">
                        {match.commentarySessions.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-cg-green/10 px-1.5 py-0.5 text-[9px] text-cg-green">
                            <Mic size={10} />
                            {match.commentarySessions.length}
                          </span>
                        )}
                        {match.blogs.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-300">
                            <FileText size={10} />
                            {match.blogs.length}
                          </span>
                        )}
                      </div>
                    </div>
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

      <div className="mt-8 rounded-2xl border border-gray-800 bg-cg-dark-2 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Match Preview Board</h3>
            <p className="text-sm text-gray-400">
              {selectedMatches.length > 0
                ? `Fixtures and linked coverage for ${selectedDate}`
                : `No fixtures scheduled for ${selectedDate}`}
            </p>
          </div>
          {selectedMatches.length > 0 && (
            <span className="rounded-full border border-cg-green/20 bg-cg-green/10 px-3 py-1 text-xs font-semibold text-cg-green">
              {selectedMatches.length} match{selectedMatches.length === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {selectedMatches.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-700 bg-cg-dark px-4 py-8 text-center text-sm text-gray-500">
            Pick another date in the calendar to preview upcoming or ongoing matches.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {selectedMatches.map((match) => (
              <div key={match.id} className="rounded-xl border border-gray-800 bg-cg-dark p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold text-white",
                        getMatchTypeColor(match.matchType)
                      )}
                    >
                      {match.matchType}
                    </span>
                    <h4 className="mt-3 text-lg font-bold text-white">{match.name}</h4>
                    <p className="mt-1 text-sm text-gray-400">{match.venue}</p>
                  </div>
                  <span className="text-xs text-gray-500">{match.date}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/matches/${match.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Match Centre
                  </Link>
                  <Link
                    href={`/matches/${match.id}?tab=squads`}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Squad Preview
                  </Link>
                  {getPrimaryCommentary(match) ? (
                    <Link
                      href={`/commentary/${getPrimaryCommentary(match)!.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-cg-green/10 px-3 py-2 text-xs font-semibold text-cg-green hover:bg-cg-green/20"
                    >
                      <Radio size={12} />
                      {getPrimaryCommentary(match)!.status === "scheduled" ? "Scheduled Commentary" : "Live Commentary"}
                    </Link>
                  ) : (
                    <Link
                      href={`/commentary?matchId=${encodeURIComponent(match.id)}&matchName=${encodeURIComponent(match.name)}&matchType=${encodeURIComponent(match.matchType)}&status=scheduled`}
                      className="inline-flex items-center gap-1 rounded-lg bg-cg-green/10 px-3 py-2 text-xs font-semibold text-cg-green hover:bg-cg-green/20"
                    >
                      <Mic size={12} />
                      Schedule Commentary
                    </Link>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-800 bg-cg-dark-2/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Commentary</p>
                    {match.commentarySessions.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {match.commentarySessions.slice(0, 2).map((session) => (
                          <Link
                            key={session.id}
                            href={`/commentary/${session.id}`}
                            className="block text-sm text-cg-green hover:text-cg-green-light"
                          >
                            {session.status.toUpperCase()} by {session.moderator.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400">No commentary sessions linked yet.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-cg-dark-2/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Blogs</p>
                    {match.blogs.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {match.blogs.slice(0, 2).map((blog) => (
                          <Link
                            key={blog.id}
                            href={`/blog/${blog.slug}`}
                            className="block text-sm text-blue-300 hover:text-blue-200"
                          >
                            {blog.title}
                          </Link>
                        ))}
                        <Link
                          href={`/blog?matchId=${encodeURIComponent(match.id)}`}
                          className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-blue-300 hover:text-blue-200"
                        >
                          <FileText size={12} />
                          View all linked blogs
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-sm text-gray-400">No match blogs yet.</p>
                        <Link
                          href={`/blog/write?matchId=${encodeURIComponent(match.id)}&matchName=${encodeURIComponent(match.name)}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200"
                        >
                          <PenSquare size={12} />
                          Write the preview
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming List (mobile-friendly) */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-white mb-4">Upcoming Matches</h3>
        <div className="space-y-2">
          {upcomingMatches.map((match) => (
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/matches/${match.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                      >
                        View Match
                      </Link>
                      <Link
                        href={`/matches/${match.id}?tab=squads`}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                      >
                        Squads
                      </Link>
                      {getPrimaryCommentary(match) ? (
                        <Link
                          href={`/commentary/${getPrimaryCommentary(match)!.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-cg-green/10 px-2 py-1 text-[11px] font-medium text-cg-green hover:bg-cg-green/20"
                        >
                          <Radio size={12} />
                          {getPrimaryCommentary(match)!.status === "scheduled" ? "Scheduled Commentary" : "Commentary"}
                        </Link>
                      ) : (
                        <Link
                          href={`/commentary?matchId=${encodeURIComponent(match.id)}&matchName=${encodeURIComponent(match.name)}&matchType=${encodeURIComponent(match.matchType)}&status=scheduled`}
                          className="inline-flex items-center gap-1 rounded-lg bg-cg-green/10 px-2 py-1 text-[11px] font-medium text-cg-green hover:bg-cg-green/20"
                        >
                          <Mic size={12} />
                          Schedule Commentary
                        </Link>
                      )}
                      <Link
                        href={`/blog/write?matchId=${encodeURIComponent(match.id)}&matchName=${encodeURIComponent(match.name)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20"
                      >
                        <PenSquare size={12} />
                        Write Blog
                      </Link>
                      {match.blogs.length > 0 && (
                        <Link
                          href={`/blog?matchId=${encodeURIComponent(match.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-white/10"
                        >
                          <FileText size={12} />
                          {match.blogs.length} Blog{match.blogs.length === 1 ? "" : "s"}
                        </Link>
                      )}
                    </div>
                    {(match.commentarySessions.length > 0 || match.blogs.length > 0) && (
                      <div className="mt-2 space-y-1">
                        {match.commentarySessions.slice(0, 1).map((session) => (
                          <p key={session.id} className="text-[11px] text-gray-400 truncate">
                            Commentary: {session.status.toUpperCase()} by {session.moderator.name}
                          </p>
                        ))}
                        {match.blogs.slice(0, 2).map((blog) => (
                          <Link
                            key={blog.id}
                            href={`/blog/${blog.slug}`}
                            className="block text-[11px] text-blue-300 truncate hover:text-blue-200"
                          >
                            {blog.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{match.date}</span>
                </div>
              </Link>
            ))}
          {upcomingMatches.length === 0 && (
            <div className="rounded-lg border border-gray-800 bg-cg-dark-2 p-4 text-sm text-gray-400">
              No upcoming matches are available from the current API response.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
