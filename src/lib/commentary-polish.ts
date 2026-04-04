import "server-only";

import { finalizeCommentaryText } from "@/lib/commentary-format";
import { getOllamaHeaders, getOllamaUrl } from "@/lib/ollama";

const COMMENTARY_POLISH_TIMEOUT_MS = 4_500;
const OLLAMA_URL = getOllamaUrl();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:latest";

export type PolishPlayer = {
  name: string;
  role?: string;
  team?: string;
};

type CommentaryPolishOptions = {
  /** Flat list of player name strings — kept for backwards compatibility */
  playerNames?: string[];
  /** Rich player objects with name + role — preferred when available */
  players?: PolishPlayer[];
  keyterms?: string[];
  preNormalizedText?: string;
};

function normalizeModelOutput(text: string): string {
  return text
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a compact roster block for the system prompt.
 *
 * If rich `players` are available we emit a formatted table so Qwen has
 * role context to resolve ambiguous names:
 *
 *   Player Roster (use these exact spellings):
 *   • Jasprit Bumrah            — Bowler
 *   • Virat Kohli               — Batter
 *   • Ravindra Jadeja           — All-rounder
 *
 * Otherwise we fall back to the flat name list.
 */
function buildPlayerRosterBlock(options?: CommentaryPolishOptions): string {
  // Prefer rich player objects
  if (options?.players && options.players.length > 0) {
    const rows = options.players
      .map((p) => {
        const roleSuffix = p.role ? ` — ${p.role}` : "";
        const teamSuffix = p.team ? ` (${p.team})` : "";
        return `  • ${p.name}${roleSuffix}${teamSuffix}`;
      })
      .join("\n");

    return `\nPlayer Roster — use EXACTLY these spellings and refer to roles when resolving ambiguous transcriptions:\n${rows}`;
  }

  // Fallback: plain name list
  if (options?.playerNames && options.playerNames.length > 0) {
    return `\nValid player names for this match: ${options.playerNames.join(", ")}.`;
  }

  return "";
}

function buildSystemPrompt(options?: CommentaryPolishOptions) {
  const rosterBlock = buildPlayerRosterBlock(options);

  const keytermContext =
    options?.keyterms && options.keyterms.length > 0
      ? ` Match context terms: ${options.keyterms.join(", ")}.`
      : "";

  const playerInstructions = rosterBlock
    ? `\n\nPlayer name correction rules (IMPORTANT):\n- You MUST treat player-name repair as a primary task.\n- If the commentary contains a garbled proper noun, initials, partial name, a close misspelling, or a phonetically similar word that plausibly refers to a player in the roster, rewrite it to the exact spelling from the roster.\n- Use the player's ROLE as additional context: for example, if you see "the bowler Bumra" and the roster lists "Jasprit Bumrah — Bowler", correct it to "Jasprit Bumrah".\n- Initials like "AR", "A Raghu", "V Chak", or "KL" should be expanded to the most likely unique player using first+last initials vs the roster.\n- If a capitalized phrase looks like a player name but does not exactly match, choose the nearest roster player whose role is consistent with the context (e.g., "hit a six" → batter; "clean bowled" → bowler).`
    : "";

  return `You are a fast finalizer for live cricket commentary.

Your job is to make the transcript publish-ready while staying very close to what the speaker actually said.

Core rules:
- Make minimal edits.
- Fix grammar, punctuation, capitalization, and obvious speech-to-text mistakes.
- Remove accidental repetition, filler fragments, and false starts only when they are clearly unintended.
- Preserve the meaning, tone, and cricket facts.
- Do not add new facts, new opinions, or new players.
- Do not replace unclear words with unrelated words.
- If a phrase is uncertain, prefer the closest cricket proper noun over an unrelated rewrite.
- Do not delete a named entity just because it is not in the current squad.
- If a likely cricketer or cricket proper noun is spoken imperfectly, repair it from general cricket knowledge when confidence is high. For example, "Boombra" should usually become "Bumrah".
- Keep team abbreviations like KKR and SRH uppercase.
${rosterBlock}${playerInstructions}${keytermContext}

Return only one final corrected commentary line.`;
}

function buildUserPrompt(input: string, fallback: string, options?: CommentaryPolishOptions) {
  const normalizedHint =
    options?.preNormalizedText && options.preNormalizedText !== fallback
      ? `Reference normalization:\n${options.preNormalizedText}\n\n`
      : "";

  return `Raw transcript:\n${input}\n\n${normalizedHint}Light cleanup baseline:\n${fallback}\n\nProduce a lightly refined final line that:\n- sticks closely to the raw speech\n- fixes grammar and punctuation\n- removes obvious accidental repetition\n- corrects player names to exact roster spellings (using role context where ambiguous)\n- preserves or repairs cricket names instead of dropping them`;
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
