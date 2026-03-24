/**
 * GET /api/match-info?id=<matchId>
 *
 * Server-side proxy for CricAPI match_info endpoint.
 * Applies a 12-hour server cache as a second layer of defence
 * (React Query provides the primary client-side cache).
 */
import { NextRequest, NextResponse } from "next/server";

const API_KEY  = process.env.CRICKET_API_KEY || "";
const BASE_URL = "https://api.cricapi.com/v1";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("id");
  if (!matchId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${BASE_URL}/match_info?apikey=${API_KEY}&id=${encodeURIComponent(matchId)}`,
      {
        // Server-side cache: 12 hours — backs up the React Query client cache
        next: { revalidate: 12 * 60 * 60 },
      }
    );

    if (!res.ok) {
      console.error(`[/api/match-info] upstream HTTP ${res.status}`);
      return NextResponse.json({ error: `Upstream error ${res.status}` }, { status: 502 });
    }

    const json = await res.json();

    if (json.status !== "success" || !json.data) {
      console.error("[/api/match-info] non-success:", json.status);
      return NextResponse.json({ error: "API returned non-success" }, { status: 502 });
    }

    return NextResponse.json(json.data);
  } catch (err) {
    console.error("[/api/match-info]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
