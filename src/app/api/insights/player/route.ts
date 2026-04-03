import { NextResponse } from "next/server";
import { forwardAiService } from "@/lib/ai-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const upstream = await forwardAiService(
      `/t20-insights/player?name=${encodeURIComponent(name)}`
    );

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.contentType },
    });
  } catch (error) {
    console.error("Insights player proxy error:", error);
    return NextResponse.json(
      { error: "Unable to reach the T20 insights service" },
      { status: 502 }
    );
  }
}
