import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const checks = {
    database: false,
    googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    nextAuthConfigured: Boolean(process.env.NEXTAUTH_URL && process.env.NEXTAUTH_SECRET),
    cricApiConfigured: Boolean(process.env.CRICKET_API_KEY),
    sportMonksConfigured: Boolean(process.env.SPORTMONKS_API_TOKEN),
    ollamaConfigured: Boolean(process.env.OLLAMA_URL),
    ollamaModel: process.env.OLLAMA_BQS_MODEL || process.env.OLLAMA_MODEL || "qwen3.5:latest",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error("Health check database error:", error);
  }

  const ok =
    checks.database &&
    checks.nextAuthConfigured &&
    checks.googleAuthConfigured &&
    checks.cricApiConfigured;

  return NextResponse.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
