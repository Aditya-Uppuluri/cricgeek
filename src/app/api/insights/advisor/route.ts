import { NextRequest, NextResponse } from "next/server";
import { forwardAiService } from "@/lib/ai-service";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await forwardAiService("/t20-insights/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.contentType },
    });
  } catch (error) {
    console.error("Insights advisor proxy error:", error);
    return NextResponse.json(
      { error: "Unable to reach the T20 insights service" },
      { status: 502 }
    );
  }
}
