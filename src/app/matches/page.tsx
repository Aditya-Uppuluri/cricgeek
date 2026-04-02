import { getLiveMatchesWithSource } from "@/lib/cricket-api";
import MatchesClient from "./MatchesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Cricket Matches | CricGeek",
  description: "Live cricket scores, ball-by-ball updates, and full scorecards for all international and league matches.",
};

export const revalidate = 30;
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const { matches, source } = await getLiveMatchesWithSource();
  return <MatchesClient initialMatches={matches} source={source} />;
}
