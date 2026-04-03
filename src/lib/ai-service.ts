const DEFAULT_AI_SERVICE_URL = "http://127.0.0.1:8000";
const DEFAULT_INSIGHTS_SERVICE_URL = "http://127.0.0.1:8010";
const vercelInsightsUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/_insights`
  : undefined;

const configuredInsightsServiceUrl =
  process.env.INSIGHTS_URL ||
  process.env.T20_INSIGHTS_URL ||
  vercelInsightsUrl ||
  (process.env.NODE_ENV !== "production" ? DEFAULT_INSIGHTS_SERVICE_URL : undefined) ||
  process.env.AI_SERVICE_URL ||
  DEFAULT_AI_SERVICE_URL;

const configuredAiServiceUrl =
  process.env.AI_SERVICE_URL ||
  DEFAULT_AI_SERVICE_URL;

export const AI_SERVICE_URL = configuredAiServiceUrl;
export const INSIGHTS_SERVICE_URL = configuredInsightsServiceUrl;

const isLocalAiService =
  configuredAiServiceUrl.includes("127.0.0.1") || configuredAiServiceUrl.includes("localhost");
const isLocalInsightsService =
  configuredInsightsServiceUrl.includes("127.0.0.1") ||
  configuredInsightsServiceUrl.includes("localhost");

type ForwardResult = {
  body: string;
  contentType: string;
  ok: boolean;
  status: number;
};

function assertAiServiceAvailable() {
  const hasConfiguredProductionService = Boolean(
    process.env.INSIGHTS_URL ||
      process.env.T20_INSIGHTS_URL ||
      process.env.VERCEL_URL ||
      process.env.AI_SERVICE_URL
  );

  if (process.env.NODE_ENV === "production" && !hasConfiguredProductionService && isLocalAiService) {
    throw new Error("No AI service URL is configured for production");
  }
}

function assertInsightsServiceAvailable() {
  const hasConfiguredProductionService = Boolean(
    process.env.INSIGHTS_URL ||
      process.env.T20_INSIGHTS_URL ||
      process.env.VERCEL_URL ||
      process.env.AI_SERVICE_URL
  );

  if (
    process.env.NODE_ENV === "production" &&
    !hasConfiguredProductionService &&
    isLocalInsightsService
  ) {
    throw new Error("No deployed insights service URL is configured for production");
  }
}

export async function forwardAiService(path: string, init?: RequestInit): Promise<ForwardResult> {
  assertAiServiceAvailable();

  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    ...init,
    cache: "no-store",
  });

  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") || "application/json",
    ok: response.ok,
    status: response.status,
  };
}

export async function forwardInsightsService(
  path: string,
  init?: RequestInit
): Promise<ForwardResult> {
  assertInsightsServiceAvailable();

  const response = await fetch(`${INSIGHTS_SERVICE_URL}${path}`, {
    ...init,
    cache: "no-store",
  });

  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") || "application/json",
    ok: response.ok,
    status: response.status,
  };
}
