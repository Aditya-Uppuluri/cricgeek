import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, PenSquare, Radio } from "lucide-react";
import EdaCards from "@/components/matches/EdaCards";
import EdaAskPanel from "@/components/matches/EdaAskPanel";
import BattingLeadersTable from "@/components/matches/BattingLeadersTable";
import BowlingLeadersTable from "@/components/matches/BowlingLeadersTable";
import InningsSummaryGrid from "@/components/matches/InningsSummaryGrid";
import LiveEdaCharts from "@/components/matches/LiveEdaCharts";
import PostMatchSignals from "@/components/matches/PostMatchSignals";
import { getMatchInfo, getMatchScorecard } from "@/lib/cricket-api";
import { buildPostMatchEdaReport } from "@/lib/eda/post-match";
import { getMatchCoverage } from "@/lib/match-coverage";

export type MatchAnalysisPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMatchAnalysisMetadata({
  params,
}: MatchAnalysisPageProps): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchInfo(id);
  return {
    title: match ? `${match.name} Analysis | CricGeek` : "Post-Match Analysis | CricGeek",
    description: match
      ? `Post-match EDA report, scorecard analytics, and linked coverage for ${match.name}`
      : "Cricket post-match analysis",
  };
}

export async function MatchAnalysisPageContent({ params }: MatchAnalysisPageProps) {
  const { id } = await params;
  const [match, scorecards, coverage] = await Promise.all([
    getMatchInfo(id),
    getMatchScorecard(id),
    getMatchCoverage(id),
  ]);

  if (!match) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-white">Analysis unavailable</h1>
        <p className="mt-2 text-sm text-gray-400">We could not load the analysis for this match.</p>
      </div>
    );
  }

  const report = await buildPostMatchEdaReport(match, scorecards);
  const intel = report.intel;
  const retrospective = report.retrospective;
  const isReportReady = match.matchEnded && intel.inningsSummaries.length > 0;
  const { commentarySession, blogs, coverageAvailable } = coverage;

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
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white">
            Confidence {Math.round(report.confidence.score)}% · {report.confidence.label}
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
        <h2 className="text-lg font-bold text-white">Historical Benchmarks</h2>
        <p className="mt-1 text-sm text-gray-400">How the result compares against venue and rivalry baselines from the local warehouse.</p>
        <div className="mt-5">
          <EdaCards cards={report.benchmarkCards} />
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
        <h2 className="text-lg font-bold text-white">Retrospective Summary</h2>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-gray-300">{retrospective.summary}</p>
        <div className="mt-5">
          <EdaCards cards={retrospective.matchSummaryCards} />
        </div>
        {retrospective.warnings.length > 0 ? (
          <div className="mt-4 space-y-2">
            {retrospective.warnings.map((warning) => (
              <p key={warning} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
          <h2 className="text-lg font-bold text-white">Batting Analysis</h2>
          <p className="mt-1 text-sm text-gray-400">Tempo, shape, and pressure conversion from the decisive innings.</p>
          <div className="mt-5">
            <EdaCards cards={retrospective.battingCards} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
          <h2 className="text-lg font-bold text-white">Bowling Analysis</h2>
          <p className="mt-1 text-sm text-gray-400">Control overs, wicket clusters, and the most damaging leaks.</p>
          <div className="mt-5">
            <EdaCards cards={retrospective.bowlingCards} />
          </div>
        </div>
      </div>

      {retrospective.analytics ? (
        <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
          <h2 className="text-lg font-bold text-white">Win Probability Retrospective</h2>
          <p className="mt-1 text-sm text-gray-400">
            Reconstructed from the tracked final-innings live stream. The replay focuses on the provider&apos;s last available innings feed.
          </p>
          <div className="mt-5">
            <LiveEdaCharts
              analytics={retrospective.analytics}
              ballsTracked={retrospective.ballsTracked}
              completedOvers={Math.max(Math.floor(match.score[match.score.length - 1]?.o ?? 0), 0)}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
        <h2 className="text-lg font-bold text-white">Advanced Cards</h2>
        <p className="mt-1 text-sm text-gray-400">Clutch performers, expected-vs-actual delta, tactical leaks, and matchup wins.</p>
        <div className="mt-5">
          <EdaCards cards={retrospective.advancedCards} />
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
            <h2 className="text-lg font-bold text-white">Recommendation Review</h2>
            <p className="mt-1 text-sm text-gray-400">Production engine calibration and trust notes for the current recommendation stack.</p>
            <div className="mt-4">
              <EdaCards cards={retrospective.recommendationReviewCards} />
            </div>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              {retrospective.recommendationReviewNotes.map((item) => (
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
            <h2 className="text-lg font-bold text-white">Final Ratings</h2>
            <div className="mt-4 space-y-3">
              {retrospective.ratings.map((rating) => (
                <div key={rating.label} className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{rating.label}</p>
                    <p className="text-lg font-black text-cg-green">{Math.round(rating.score)}</p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-cg-green" style={{ width: `${Math.min(100, rating.score)}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{rating.insight}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Historical Context</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-300">
              <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                <p className="font-semibold text-white">Venue</p>
                <p className="mt-1 text-gray-400">{report.historical.venue.summary}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                <p className="font-semibold text-white">Head-to-head</p>
                <p className="mt-1 text-gray-400">{report.historical.headToHead.summary}</p>
              </div>
              {report.historical.winnerForm ? (
                <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  <p className="font-semibold text-white">Winner form</p>
                  <p className="mt-1 text-gray-400">{report.historical.winnerForm.summary}</p>
                </div>
              ) : null}
              {report.historical.loserForm ? (
                <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  <p className="font-semibold text-white">Opponent form</p>
                  <p className="mt-1 text-gray-400">{report.historical.loserForm.summary}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
            <h2 className="text-lg font-bold text-white">Coverage Links</h2>
            <div className="mt-4 space-y-3 text-sm">
              {!coverageAvailable ? (
                <p className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3 text-gray-400">
                  Linked commentary and match blogs are temporarily unavailable, but the EDA report is still live.
                </p>
              ) : commentarySession ? (
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

              {!coverageAvailable ? null : blogs.length > 0 ? blogs.map((blog) => (
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
              {[...intel.reportNotes, ...retrospective.biggestSwings].map((item) => (
                <li key={item} className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <EdaAskPanel
        matchId={match.id}
        suggestions={[
          "What decided this match more than the raw margin suggests?",
          ...intel.turningPoints.slice(0, 2),
          "How did the result compare with venue and rivalry history?",
        ]}
      />
    </div>
  );
}
