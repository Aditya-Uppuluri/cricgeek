const DEFAULT_AI_SERVICE_URL = "http://127.0.0.1:8000";

export const AI_SERVICE_URL = process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL;

const isLocalAiService =
  AI_SERVICE_URL.includes("127.0.0.1") || AI_SERVICE_URL.includes("localhost");

type ForwardResult = {
  body: string;
  contentType: string;
  ok: boolean;
  status: number;
};

function assertAiServiceAvailable() {
  if (process.env.NODE_ENV === "production" && !process.env.AI_SERVICE_URL && isLocalAiService) {
    throw new Error("AI_SERVICE_URL is not configured for production");
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
