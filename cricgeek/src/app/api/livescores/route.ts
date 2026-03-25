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
import { getCurrentMatches, getSeriesMatches, isCricApiConfigured, isCricApiKeySet } from "@/services/cricapi";
import type { Match } from "@/types/cricket";

export const dynamic = "force-dynamic"; // Always fresh — never statically cached

export async function GET() {
  try {
    let matches: Match[] = [];
    let source: string;

    if (isSportMonksConfigured()) {
      // SportMonks: primary real-time source
      const live = await getSMLivescores();
      const upcoming = live && live.length > 0 ? [] : (await getSMUpcoming() ?? []);
      matches = [...(live ?? []), ...upcoming];
      source = "sportmonks";
    } else if (isCricApiKeySet()) {
      // Only 1 live API call per poll — series_info is server-cached (revalidate:30)
      const [current, series] = await Promise.all([
        getCurrentMatches(),
        isCricApiConfigured() ? getSeriesMatches() : Promise.resolve([]),
      ]);
      const seen = new Set<string>(current.map((m) => m.id));
      matches = [...current, ...series.filter((m) => !seen.has(m.id))];
      source = "cricapi-current";
    } else {
      source = "fallback";
      matches = [];
    }

    return NextResponse.json({
      ok: true,
      source,
      count: matches.length,
      updatedAt: new Date().toISOString(),
      matches,
    });
  } catch (err) {
    console.error("[/api/livescores]", err);
    return NextResponse.json({ ok: false, matches: [] }, { status: 500 });
  }
}
