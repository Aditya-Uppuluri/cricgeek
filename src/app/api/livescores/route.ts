/**
 * GET /api/livescores
 *
 * Server-side proxy that fetches live scores from CricAPI
 * and returns normalised Match objects as JSON.
 *
 * The browser polls this route every 30 s from the LiveScoresTicker
 * component — the API token is never exposed to the client.
 */
import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/cricket-api";

export const dynamic = "force-dynamic";   // Always fresh — never statically cached

export async function GET() {
  try {
    const matches = await getLiveMatches();

    return NextResponse.json({
      ok: true,
      source: "cricapi",
      count: matches.length,
      updatedAt: new Date().toISOString(),
      matches,
    });
  } catch (err) {
    console.error("[/api/livescores]", err);
    return NextResponse.json({ ok: false, matches: [] }, { status: 500 });
  }
}
