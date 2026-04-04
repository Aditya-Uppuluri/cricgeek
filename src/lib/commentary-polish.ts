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
      ? `\nMatch context keywords: ${options.keyterms.join(", ")}.`
      : "";

  const rosterInstructions = rosterBlock
    ? `\n\nPLAYER NAME CORRECTION — this is your most critical task:\n- Every player name in the transcript MUST be corrected to the exact spelling from the roster below.\n- Use BOTH the roster spelling AND the semantic context of the sentence to identify which player is being referred to. For example, if the sentence says "the bowler took a wicket" and the roster shows Jasprit Bumrah as Bowler, and the spoken name sounds like "Bumra" or "Boom-ra", output "Jasprit Bumrah".\n- Initials like "AR", "VK", "A Raghu", or phonetic approximations like "Angrish Raghuvanshi" must be resolved to the closest matching full name in the roster.\n- If a name is close to a roster entry (phonetically, by initials, or by partial spelling), always prefer the roster name over the raw transcript word.\n- Keep team abbreviations (KKR, MI, SRH, RCB, etc.) uppercase and unchanged.`
    : "";

  return `You are a cricket commentary post-processor. Your job is to take a raw speech-to-text transcript and fully rewrite it into a clean, publish-ready commentary line.

You MUST do the following — no exceptions:
1. Fix all grammar, punctuation, and sentence structure so the output reads like polished written English.
2. Correct every player name to its exact proper spelling, using the team roster provided AND the semantic meaning of the sentence (e.g. who is batting, who is bowling, who ran someone out) to resolve any ambiguity.
3. Preserve the speaker's original meaning, opinion, and cricket facts — do not add or remove facts.
4. Remove filler words, false starts, and accidental repetition.
5. Do NOT leave any misspelled, garbled, or phonetically-approximated player name in the output — always resolve it to the correct roster name.
${rosterBlock}${rosterInstructions}${keytermContext}

Return ONLY the final corrected commentary line. No explanations, no preamble.`;
}

function buildUserPrompt(input: string, _fallback: string, options?: CommentaryPolishOptions) {
  const preNorm =
    options?.preNormalizedText && options.preNormalizedText !== input
      ? `\nPre-normalized (rule-based name correction already applied):\n${options.preNormalizedText}\n`
      : "";

  return `Take the following raw speech-to-text transcript and completely convert it into a grammatically correct, properly punctuated commentary line with all player names corrected to their exact proper spellings as per the team roster and the semantic context of the sentence.\n\nRaw transcript:\n${input}\n${preNorm}\nOutput the fully corrected commentary line:`;
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

    // Allow up to 2.5× the fallback length — a full rewrite can be longer
    if (polished.length > fallback.length * 2.5) {
      return fallback;
    }

    return polished;
  } catch {
    return fallback;
  }
}
