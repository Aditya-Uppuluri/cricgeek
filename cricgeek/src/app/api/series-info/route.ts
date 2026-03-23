/**
 * GET /api/series-info?id=<seriesId>
 *
 * Server-side proxy for CricAPI series_info endpoint.
 * Keeps the API key out of the browser and lets the client
 * drive caching entirely through React Query.
 */
import { NextRequest, NextResponse } from "next/server";

const API_KEY  = process.env.CRICKET_API_KEY || "";
const BASE_URL = "https://api.cricapi.com/v1";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("id");
  if (!seriesId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${BASE_URL}/series_info?apikey=${API_KEY}&id=${encodeURIComponent(seriesId)}`,
      { cache: "no-store" } // caching is handled client-side by React Query
    );

    if (!res.ok) {
      console.error(`[/api/series-info] upstream HTTP ${res.status}`);
      return NextResponse.json({ error: `Upstream error ${res.status}` }, { status: 502 });
    }

    const json = await res.json();

    if (json.status !== "success" || !json.data) {
      console.error("[/api/series-info] non-success:", json.status);
      return NextResponse.json({ error: "API returned non-success" }, { status: 502 });
    }

    // Return { info, matchList } — the shape useSeriesInfo expects
    return NextResponse.json(json.data);
  } catch (err) {
    console.error("[/api/series-info]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
