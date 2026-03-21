import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// POST /api/commentary/transcribe — proxy audio to Python Whisper service
export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id: string; role: string } | undefined;

  if (!user || !["moderator", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Forward to the Python AI service
    const proxyForm = new FormData();
    proxyForm.append("audio", audioFile);

    const response = await fetch(`${AI_SERVICE_URL}/transcribe`, {
      method: "POST",
      body: proxyForm,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("AI service transcription error:", errorBody);
      return NextResponse.json(
        { error: "Transcription failed", detail: errorBody },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Transcription proxy error:", error);
    return NextResponse.json(
      { error: "Failed to reach transcription service" },
      { status: 502 }
    );
  }
}
