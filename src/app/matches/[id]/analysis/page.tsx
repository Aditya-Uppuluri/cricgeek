import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, PenSquare, Radio } from "lucide-react";
import EdaCards from "@/components/matches/EdaCards";
import BattingLeadersTable from "@/components/matches/BattingLeadersTable";
import BowlingLeadersTable from "@/components/matches/BowlingLeadersTable";
import InningsSummaryGrid from "@/components/matches/InningsSummaryGrid";
import PostMatchSignals from "@/components/matches/PostMatchSignals";
import { getMatchInfo, getMatchScorecard } from "@/lib/cricket-api";
import { buildPostMatchIntel } from "@/lib/match-intelligence";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchInfo(id);
  return {
    title: match ? `${match.name} Analysis | CricGeek` : "Post-Match Analysis | CricGeek",
    description: match ? `Post-match analytics and EDA cards for ${match.name}` : "Cricket post-match analysis",
  };
}

export default async function MatchAnalysisPage({ params }: PageProps) {
  const { id } = await params;
  const [match, scorecards, commentarySession, blogs] = await Promise.all([
    getMatchInfo(id),
    getMatchScorecard(id),
    prisma.liveCommentarySession.findFirst({
      where: { matchId: id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true },
    }),
    prisma.blog.findMany({
      where: { matchTag: id, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, slug: true },
    }),
  ]);

  if (!match) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-white">Analysis unavailable</h1>
        <p className="mt-2 text-sm text-gray-400">We could not load the analysis for this match.</p>
      </div>
    );
  }

  const intel = await buildPostMatchIntel(match, scorecards);
  const isReportReady = match.matchEnded && intel.inningsSummaries.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link href={`/matches/${match.id}`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft size={14} />
        Back to Match Centre
      </Link>

      <div className="rounded-2xl border border-gray-800 bg-cg-dark-2 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cg-green">Post-Match Analysis</p>
        <h1 className="mt-3 text-3xl font-black text-white">{intel.headline}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300">{intel.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isReportReady ? "bg-cg-green/10 text-cg-green" : "bg-amber-500/10 text-amber-300"}`}>
            {isReportReady ? "Full scorecard EDA ready" : "Live / partial EDA"}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
            {match.status}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
        <h2 className="text-lg font-bold text-white">EDA Cards</h2>
        <p className="mt-1 text-sm text-gray-400">Scorecard-derived analytics cards for quick post-match pattern reading.</p>
        <div className="mt-5">
          <EdaCards cards={intel.edaCards} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
        <h2 className="text-lg font-bold text-white">Match Signals</h2>
        <p className="mt-1 text-sm text-gray-400">Deterministic reads of tempo, batting support, boundary dependence, lower-order lift, and bowling control.</p>
        <div className="mt-5">
          <PostMatchSignals signals={intel.matchSignals} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
        <h2 className="text-lg font-bold text-white">Innings Fingerprints</h2>
        <p className="mt-1 text-sm text-gray-400">A per-innings EDA read of where the runs came from and how concentrated the batting effort was.</p>
        <div className="mt-5">
          <InningsSummaryGrid summaries={intel.inningsSummaries} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Turning Points</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              {intel.turningPoints.map((item) => (
                <li key={item} className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Tactical Takeaways</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              {intel.tacticalTakeaways.map((item) => (
                <li key={item} className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Batting Impact Table</h2>
            <p className="mt-1 text-sm text-gray-400">Top batting contributions ranked by runs first, then scoring speed.</p>
            <div className="mt-4">
              <BattingLeadersTable leaders={intel.battingLeaders} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Bowling Impact Table</h2>
            <p className="mt-1 text-sm text-gray-400">Best wicket-taking spells with economy used as the separator.</p>
            <div className="mt-4">
              <BowlingLeadersTable leaders={intel.bowlingLeaders} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Standout Performers</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              {intel.standoutPerformers.map((item) => (
                <li key={item} className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Coverage Links</h2>
            <div className="mt-4 space-y-3 text-sm">
              {commentarySession ? (
                <Link
                  href={`/commentary/${commentarySession.id}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-cg-dark px-4 py-3 text-cg-green hover:bg-white/5"
                >
                  <Radio size={14} />
                  Open {commentarySession.status === "ended" ? "archived" : commentarySession.status} commentary
                </Link>
              ) : (
                <p className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3 text-gray-400">
                  No commentary session is linked to this match yet.
                </p>
              )}

              {blogs.length > 0 ? blogs.map((blog) => (
                <Link
                  key={blog.id}
                  href={`/blog/${blog.slug}`}
                  className="block rounded-lg border border-gray-800 bg-cg-dark px-4 py-3 text-blue-300 hover:bg-white/5"
                >
                  {blog.title}
                </Link>
              )) : (
                <Link
                  href={`/blog/write?matchId=${encodeURIComponent(match.id)}&matchName=${encodeURIComponent(match.name)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-blue-300 hover:bg-blue-500/10"
                >
                  <PenSquare size={14} />
                  Write the first linked match blog
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Reporting Notes</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              {intel.reportNotes.map((item) => (
                <li key={item} className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
