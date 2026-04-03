import "server-only";

import { finalizeCommentaryText } from "@/lib/commentary-format";
import { getOllamaHeaders, getOllamaUrl } from "@/lib/ollama";

const COMMENTARY_POLISH_TIMEOUT_MS = 4_500;
const OLLAMA_URL = getOllamaUrl();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:latest";

type CommentaryPolishOptions = {
  playerNames?: string[];
  preNormalizedText?: string;
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
      ? ` Valid player names for this match: ${options.playerNames.join(", ")}. You must treat player-name repair as part of the job. If the commentary contains a garbled proper noun, initials, partial name, or a close misspelling that likely refers to one of these players, rewrite it to the closest valid player name from the list. If a capitalized phrase looks like a player but is not exactly correct, choose the nearest valid squad player. If initials like "AR", "A Raghu", "V Chakrabarthy", or similar appear, expand them to the most likely unique squad player.`
      : "";

  return `You are a fast finalizer for live cricket commentary. Fix grammar, punctuation, capitalization, readability, and player-name recognition. Preserve the meaning, tone, and cricket facts. Keep team abbreviations like KKR and SRH uppercase. Do not add new facts, players, or stats.${playerContext} Return only the final corrected commentary text.`;
}

function buildUserPrompt(input: string, fallback: string, options?: CommentaryPolishOptions) {
  const normalizedHint =
    options?.preNormalizedText && options.preNormalizedText !== fallback
      ? `Reference normalization:\n${options.preNormalizedText}\n\n`
      : "";

  return `Raw transcript:\n${input}\n\n${normalizedHint}Light cleanup baseline:\n${fallback}\n\nReturn one final commentary line with corrected names, grammar, punctuation, and capitalization.`;
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
        options: {
          temperature: 0,
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(options),
          },
          {
            role: "user",
            content: buildUserPrompt(input, fallback, options),
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
