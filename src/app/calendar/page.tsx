import { getUpcomingMatches } from "@/lib/cricket-api";
import CalendarClient from "./CalendarClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cricket Calendar | CricGeek",
  description: "Complete cricket match calendar. Never miss a match — World Cup, IPL, and all international fixtures.",
};

export default async function CalendarPage() {
  const matches = await getUpcomingMatches();
  return <CalendarClient matches={matches} />;
}
