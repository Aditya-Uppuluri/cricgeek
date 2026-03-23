/**
 * GET /api/series
 * Proxies CricAPI /v1/series — returns the full series list.
 * Caching is handled client-side by React Query.
 */
import { NextResponse } from "next/server";

const API_KEY  = process.env.CRICKET_API_KEY || "";
const BASE_URL = "https://api.cricapi.com/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${BASE_URL}/series?apikey=${API_KEY}&offset=0`, {
      cache: "no-store",
    });

    const json = await res.json();

    // CricAPI may return HTTP 200 with status:"failure" on rate limit / bad key
    if (!res.ok || json.status !== "success" || !json.data) {
      console.warn("[/api/series] upstream issue:", res.status, json.status);
      return NextResponse.json([]); // return empty array so UI degrades gracefully
    }

    return NextResponse.json(json.data);
  } catch (err) {
    console.error("[/api/series]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
