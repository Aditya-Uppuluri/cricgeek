import { getLiveMatches } from "@/lib/cricket-api";
import { isSportMonksConfigured } from "@/lib/sportmonks";
import MatchesClient from "./MatchesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Cricket Scores | CricGeek",
  description: "Live cricket scores, ball-by-ball updates, and full scorecards. Real-time data via SportMonks for all international and league matches.",
};

export const revalidate = 30;

export default async function MatchesPage() {
  const [matches] = await Promise.all([getLiveMatches()]);

  const source = isSportMonksConfigured() ? "sportmonks" : "fallback";

  return <MatchesClient initialMatches={matches} source={source} />;
}
