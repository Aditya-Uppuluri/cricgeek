import type { Metadata } from "next";
import { getLiveMatches } from "@/lib/cricket-api";
import InsightsClient from "./InsightsClient";

export const metadata: Metadata = {
  title: "AI Insights | CricGeek",
  description:
    "Integrated T20 decision support for live match situations, batting and bowling recommendations, model evaluation, and player exploration.",
};

export const runtime = "nodejs";
export const revalidate = 60;

export default async function InsightsPage() {
  const matches = await getLiveMatches();
  const t20Matches = matches.filter((match) => /t20/i.test(match.matchType) && match.matchStarted);

  return <InsightsClient initialMatches={t20Matches} />;
}
