import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import EdaCards from "@/components/matches/EdaCards";
import { getMatchInfo, getMatchScorecard } from "@/lib/cricket-api";
import { buildPostMatchIntel } from "@/lib/match-intelligence";

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
  const [match, scorecards] = await Promise.all([
    getMatchInfo(id),
    getMatchScorecard(id),
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
      </div>

      <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
        <h2 className="text-lg font-bold text-white">EDA Cards</h2>
        <p className="mt-1 text-sm text-gray-400">Scorecard-derived analytics cards for quick post-match pattern reading.</p>
        <div className="mt-5">
          <EdaCards cards={intel.edaCards} />
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
        </div>

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
      </div>
    </div>
  );
}
