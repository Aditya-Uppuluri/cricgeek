import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOllamaUrl } from "@/lib/ollama";

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL;
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const trustHost =
    process.env.AUTH_TRUST_HOST === "true" ||
    process.env.TRUST_HOST === "true" ||
    process.env.NODE_ENV !== "production";
  const matchDataConfigured =
    Boolean(process.env.CRICKET_API_KEY) ||
    Boolean(process.env.SPORTMONKS_API_TOKEN) ||
    process.env.ALLOW_MOCK_MATCH_DATA === "true";

  const checks = {
    database: false,
    googleAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    credentialsAuthConfigured: Boolean(authSecret && (authUrl || trustHost)),
    nextAuthConfigured: Boolean(authSecret),
    authUrlConfigured: Boolean(authUrl || trustHost),
    cricApiConfigured: Boolean(process.env.CRICKET_API_KEY),
    sportMonksConfigured: Boolean(process.env.SPORTMONKS_API_TOKEN),
    matchDataConfigured,
    searchConfigured: Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY),
    searchProvider: process.env.SERPER_API_KEY ? "serper" : process.env.TAVILY_API_KEY ? "tavily" : "none",
    ollamaConfigured: Boolean(ollamaUrl),
    ollamaUrl: ollamaUrl || getOllamaUrl(),
    ollamaSharedSecretConfigured: Boolean(process.env.OLLAMA_SHARED_SECRET),
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
    checks.credentialsAuthConfigured &&
    checks.matchDataConfigured;

  return NextResponse.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
