/**
 * GET /api/livescores
 *
 * Server-side proxy that fetches live scores from SportMonks
 * and returns normalised Match objects as JSON.
 *
 * The browser polls this route every 30 s from the LiveScoresTicker
 * component — the SportMonks API token is never exposed to the client.
 */
import { NextResponse } from "next/server";
import { getSMLivescores, getSMUpcoming, isSportMonksConfigured } from "@/lib/sportmonks";
import { getLiveMatches } from "@/lib/cricket-api";
import type { Match } from "@/types/cricket";

export const dynamic = "force-dynamic";   // Always fresh — never statically cached

export async function GET() {
  try {
    let matches: Match[] = [];

    if (isSportMonksConfigured()) {
      const live = await getSMLivescores();
      const upcoming = live && live.length > 0 ? [] : (await getSMUpcoming() ?? []);
      matches = [...(live ?? []), ...upcoming];
    } else {
      // Fallback to the unified getLiveMatches (CricAPI or mock)
      matches = await getLiveMatches();
    }

    return NextResponse.json({
      ok: true,
      source: isSportMonksConfigured() ? "sportmonks" : "fallback",
      count: matches.length,
      updatedAt: new Date().toISOString(),
      matches,
    });
  } catch (err) {
    console.error("[/api/livescores]", err);
    return NextResponse.json({ ok: false, matches: [] }, { status: 500 });
  }
}
