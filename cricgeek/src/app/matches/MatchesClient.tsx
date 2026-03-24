"use client";

import { useState } from "react";
import { Zap, RefreshCw, Wifi, AlertTriangle, Search, X, ArrowUpDown } from "lucide-react";
import type { Match } from "@/types/cricket";
import LiveMatchCard from "@/components/matches/LiveMatchCard";
import FormatFilter from "@/components/matches/FormatFilter";
import AdSlot from "@/components/ads/AdSlot";
import LiveScoresTicker from "@/components/matches/LiveScoresTicker";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useSeries } from "@/hooks/useSeries";
import SeriesCard from "@/components/matches/SeriesCard";
import DataSourceBadge from "@/components/dev/DataSourceBadge";
import DatePickerDropdown from "@/components/matches/DatePickerDropdown";
import StatusDropdown from "@/components/matches/StatusDropdown";
import type { StatusFilter } from "@/components/matches/StatusDropdown";

const FORMATS = ["All", "T20", "ODI", "ODI-W", "Test", "FC", "Series"] as const;
type Format = (typeof FORMATS)[number];

interface MatchesClientProps {
  initialMatches: Match[];
  source: string;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function MatchCardSkeleton() {
  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4 animate-pulse">
      {/* header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-10 bg-gray-700 rounded-full" />
        <div className="h-4 w-12 bg-gray-700 rounded-full" />
      </div>
      {/* team rows */}
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-700" />
            <div className="h-4 w-20 bg-gray-700 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-700 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-700" />
            <div className="h-4 w-24 bg-gray-700 rounded" />
          </div>
          <div className="h-4 w-10 bg-gray-700 rounded" />
        </div>
      </div>
      {/* status */}
      <div className="mt-3 pt-2.5 border-t border-gray-800/70 space-y-1.5">
        <div className="h-3 w-3/4 bg-gray-700 rounded" />
        <div className="h-2.5 w-1/2 bg-gray-800 rounded" />
      </div>
    </div>
  );
}

function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MatchesClient({ initialMatches, source }: MatchesClientProps) {
  const { data, isFetching, isError, refetch, dataUpdatedAt } = useLiveMatches(initialMatches);
  const matches = data?.matches ?? initialMatches;

  const [format, setFormat] = useState<Format>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data: seriesList, isLoading: seriesLoading } = useSeries(format === "Series");

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
    : "";

  const filtered = matches.filter((m) => {
    // Format filter
    if (format !== "All" && m.matchType?.toUpperCase() !== format.toUpperCase()) return false;

    // Search by team name
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const teamMatch =
        m.teams?.some((t) => t.toLowerCase().includes(q)) ||
        m.teamInfo?.some((t) => t.name.toLowerCase().includes(q) || t.shortname.toLowerCase().includes(q));
      if (!teamMatch) return false;
    }

    // Date range filter — use dateTimeGMT or date field
    if (startDate || endDate) {
      const matchDate = new Date(m.dateTimeGMT || m.date);
      if (startDate && matchDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (matchDate > end) return false;
      }
    }

    return true;
  });

  const hasActiveFilters = search.trim() !== "" || startDate !== "" || endDate !== "" || statusFilter !== "all";

  const sortByDate = (a: Match, b: Match) => {
    const da = new Date(a.dateTimeGMT || a.date).getTime();
    const db = new Date(b.dateTimeGMT || b.date).getTime();
    return sortOrder === "asc" ? da - db : db - da;
  };

  // Classification using boolean flags — do NOT rely solely on status string
  // statusFilter hides entire sections when a specific status is selected
  const live = (statusFilter === "all" || statusFilter === "live")
    ? filtered.filter((m) => m.matchStarted === true && m.matchEnded === false).sort(sortByDate)
    : [];
  const upcoming = (statusFilter === "all" || statusFilter === "upcoming")
    ? filtered.filter((m) => m.matchStarted === false).sort(sortByDate)
    : [];
  const completed = (statusFilter === "all" || statusFilter === "completed")
    ? filtered.filter((m) => m.matchEnded === true).sort(sortByDate)
    : [];

  return (
    <>
      {/* Live Scores Ticker */}
      <LiveScoresTicker />
      <DataSourceBadge />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Zap className="text-cg-green" />
              Live Scores
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {source === "sportmonks"
                ? "Powered by SportMonks · Real-time"
                : "Real-time scores and updates from around the cricket world"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lastUpdated && (
              <span className="text-xs text-gray-500 hidden sm:block">
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all disabled:opacity-50 shrink-0"
              title="Refresh scores"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Error banner */}
        {isError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
            <AlertTriangle size={14} className="shrink-0" />
            Failed to load data. Showing last known scores.
          </div>
        )}

        {/* Format Filter */}
        <div className="mb-4">
          <FormatFilter selected={format} onChange={setFormat} />
        </div>

        {/* Search + Date filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Team search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by team name…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cg-green transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Start date */}
          <DatePickerDropdown label="From" value={startDate} onChange={setStartDate} />

          {/* End date */}
          <DatePickerDropdown label="To" value={endDate} onChange={setEndDate} />

          {/* Status filter */}
          <StatusDropdown value={statusFilter} onChange={setStatusFilter} />

          {/* Sort order */}
          <button
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-cg-green text-gray-300 hover:text-white text-xs transition-colors shrink-0"
            title="Sort by date"
          >
            <ArrowUpDown size={12} />
            {sortOrder === "asc" ? "Oldest first" : "Newest first"}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setStatusFilter("all"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs transition-colors shrink-0"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* ── Series tab ─────────────────────────────────────────────── */}
        {format === "Series" ? (
          seriesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4 animate-pulse space-y-3">
                  <div className="h-4 w-3/4 bg-gray-700 rounded" />
                  <div className="flex gap-2">
                    <div className="h-5 w-14 bg-gray-700 rounded-full" />
                    <div className="h-5 w-14 bg-gray-700 rounded-full" />
                  </div>
                  <div className="h-3 w-1/2 bg-gray-800 rounded" />
                </div>
              ))}
            </div>
          ) : (seriesList ?? []).length === 0 ? (
            <div className="text-center py-20">
              <Zap size={40} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No series found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(seriesList ?? []).map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          )
        ) : (
        /* ── Matches tabs (All / T20 / ODI …) ───────────────────────── */
        isFetching && matches.length === 0 ? (
          <div className="space-y-8">
            <section>
              <div className="h-5 w-24 bg-gray-700 rounded animate-pulse mb-4" />
              <SectionSkeleton count={3} />
            </section>
            <section>
              <div className="h-5 w-28 bg-gray-700 rounded animate-pulse mb-4" />
              <SectionSkeleton count={3} />
            </section>
          </div>
        ) : (
          <>
            {/* Live Now */}
            {live.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="text-lg font-bold text-white">Live Now</h2>
                  <span className="text-gray-500 text-sm">({live.length})</span>
                  <Wifi size={12} className="text-red-400 ml-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {live.map((m) => <LiveMatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            <AdSlot slot="matches-mid" format="horizontal" className="mb-8 max-w-3xl mx-auto" />

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-bold text-white mb-4">Upcoming</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcoming.map((m) => <LiveMatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4">Recent Results</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completed.map((m) => <LiveMatchCard key={m.id} match={m} />)}
                </div>
              </section>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="text-center py-20">
                <Zap size={40} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">
                  No {format !== "All" ? format + " " : ""}matches found
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  {hasActiveFilters
                    ? "Try adjusting your search or date range"
                    : "Check back soon or try a different format filter"}
                </p>
              </div>
            )}
          </>
        )
        )}
      </div>
    </>
  );
}
