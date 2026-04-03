import "server-only";

import { finalizeCommentaryText } from "@/lib/commentary-format";
import { getOllamaHeaders, getOllamaUrl } from "@/lib/ollama";

const COMMENTARY_POLISH_TIMEOUT_MS = 4_500;
const OLLAMA_URL = getOllamaUrl();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:latest";

type CommentaryPolishOptions = {
  playerNames?: string[];
};

function normalizeModelOutput(text: string): string {
  return text
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSystemPrompt(options?: CommentaryPolishOptions) {
  const playerContext =
    options?.playerNames && options.playerNames.length > 0
      ? ` Valid player names for this match: ${options.playerNames.join(", ")}. If the commentary contains a garbled proper noun, initials, or a close misspelling that clearly refers to one of these players, rewrite it to the closest valid player name from the list.`
      : "";

  return `You are a fast copy editor for live cricket commentary. Fix grammar, punctuation, capitalization, and readability. Preserve the meaning, tone, and cricket facts. Keep team abbreviations like KKR and SRH uppercase. Do not add new facts, players, or stats.${playerContext} Return only the polished commentary text.`;
}

export async function polishCommentaryForSubmission(
  input: string,
  options?: CommentaryPolishOptions
): Promise<string> {
  const fallback = finalizeCommentaryText(input);

  if (!fallback) {
    return "";
  }

  if (!process.env.OLLAMA_URL && !process.env.OLLAMA_BASE_URL) {
    return fallback;
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: getOllamaHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        think: false,
        stream: false,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(options),
          },
          {
            role: "user",
            content: fallback,
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(COMMENTARY_POLISH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = await response.json();
    const candidate =
      typeof payload?.message?.content === "string"
        ? payload.message.content
        : typeof payload?.response === "string"
          ? payload.response
          : "";

    const polished = finalizeCommentaryText(normalizeModelOutput(candidate));

    if (!polished) {
      return fallback;
    }

    if (polished.length > fallback.length * 1.75) {
      return fallback;
    }

    return polished;
  } catch {
    return fallback;
  }
}
