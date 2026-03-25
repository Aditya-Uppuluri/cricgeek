import {
  getMatchInfo,
  getMatchScorecard,
  getMatchCommentary,
  getMatchSquad,
} from "@/lib/cricket-api";
import { getSMFixture, isSportMonksConfigured } from "@/lib/sportmonks";
import MatchDetailClient from "./MatchDetailClient";
import type { Metadata } from "next";

export const revalidate = 20;

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const match = isSportMonksConfigured()
    ? await getSMFixture(id) ?? await getMatchInfo(id)
    : await getMatchInfo(id);
  return {
    title: match ? `${match.name} | CricGeek` : "Match Details | CricGeek",
    description: match?.status || "Live cricket match details and scorecard",
  };
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;

  // SportMonks provides match data directly; supplement with CricAPI for scorecard/commentary
  const [smMatch, scorecard, commentary, squads] = await Promise.all([
    isSportMonksConfigured() ? getSMFixture(id) : null,
    getMatchScorecard(id),
    getMatchCommentary(id),
    getMatchSquad(id),
  ]);

  const match = smMatch ?? await getMatchInfo(id);


  if (!match) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Match Not Found</h1>
        <p className="text-gray-400">
          The match you&apos;re looking for doesn&apos;t exist or the API is unavailable.
        </p>
      </div>
    );
  }

  return (
    <MatchDetailClient
      match={match}
      scorecard={scorecard}
      commentary={commentary}
      squads={squads}
    />
  );
}
