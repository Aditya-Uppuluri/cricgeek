import { NextResponse } from "next/server";
import { forwardAiService } from "@/lib/ai-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.toString();
    const upstream = await forwardAiService(
      `/t20-insights/meta${query ? `?${query}` : ""}`
    );

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.contentType },
    });
  } catch (error) {
    console.error("Insights metadata proxy error:", error);
    return NextResponse.json(
      { error: "Unable to reach the T20 insights service" },
      { status: 502 }
    );
  }
}
