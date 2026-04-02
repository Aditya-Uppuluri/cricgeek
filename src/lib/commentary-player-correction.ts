type WordToken = {
  value: string;
  normalized: string;
  start: number;
  end: number;
  isCapitalized: boolean;
  isAllCaps: boolean;
};

type PlayerEntry = {
  canonical: string;
  tokens: string[];
  normalizedTokens: string[];
  normalizedJoined: string;
  phoneticJoined: string;
  phoneticTokens: string[];
};

type Replacement = {
  startToken: number;
  endTokenExclusive: number;
  replacement: string;
  score: number;
};

const LOWERCASE_NAME_CONNECTORS = new Set(["de", "da", "di", "van", "von", "bin", "al"]);

const MANUAL_ALIAS_OVERRIDES: Record<string, string[]> = {
  "Angkrish Raghuvanshi": [
    "english raghuvanshi",
    "angrish raghuvanshi",
    "ankrish raghuvanshi",
    "angkrish raghuwanshi",
    "angkrish raghubanshi",
    "angkrish raghuvanshee",
  ],
  "Heinrich Klaasen": [
    "henrik klaasen",
    "heinrick klaasen",
    "henrich klaasen",
    "classen",
    "klaasen",
  ],
  "Varun Chakravarthy": [
    "varun chakrabarthy",
    "varun chakraborty",
    "chakravarti",
    "chakrabarthy",
  ],
  "Quinton de Kock": [
    "quenton de kock",
    "quinton dekock",
    "quinton de cock",
  ],
  "Sunil Narine": [
    "sunil nareen",
    "sunny narine",
  ],
};

function normalizeToken(token: string) {
  return token.toLowerCase().replace(/[^a-z]/g, "");
}

function phoneticForm(token: string) {
  let text = normalizeToken(token);
  if (!text) return "";

  text = text
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/kh/g, "k")
    .replace(/ck/g, "k")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/ou/g, "u")
    .replace(/au/g, "o")
    .replace(/aa/g, "a")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .replace(/bh/g, "b")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/zh/g, "j")
    .replace(/wr/g, "r")
    .replace(/kn/g, "n");

  const first = text[0];
  const rest = text
    .slice(1)
    .replace(/[aeiouy]/g, "")
    .replace(/(.)\1+/g, "$1");

  return `${first}${rest}`;
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  const maxLength = Math.max(left.length, right.length);
  return 1 - levenshtein(left, right) / maxLength;
}

function tokenizeWords(text: string): WordToken[] {
  const matches = text.matchAll(/[A-Za-z][A-Za-z'’-]*/g);
  const tokens: WordToken[] = [];

  for (const match of matches) {
    const value = match[0];
    const start = match.index ?? 0;
    const end = start + value.length;
    tokens.push({
      value,
      normalized: normalizeToken(value),
      start,
      end,
      isCapitalized: /^[A-Z]/.test(value),
      isAllCaps: value === value.toUpperCase(),
    });
  }

  return tokens;
}

function buildPlayerEntries(playerNames: string[]) {
  return playerNames
    .map((name) => {
      const tokens = name.split(/\s+/).filter(Boolean);
      const normalizedTokens = tokens.map(normalizeToken).filter(Boolean);
      const phoneticTokens = tokens.map(phoneticForm).filter(Boolean);

      return {
        canonical: name,
        tokens,
        normalizedTokens,
        normalizedJoined: normalizedTokens.join(""),
        phoneticJoined: phoneticTokens.join(""),
        phoneticTokens,
      } satisfies PlayerEntry;
    })
    .filter((player) => player.tokens.length > 0);
}

function chooseBestSpanMatch(
  spanTokens: WordToken[],
  players: PlayerEntry[],
  requireProperNoun: boolean
) {
  const spanNormalized = spanTokens.map((token) => token.normalized).filter(Boolean);
  const spanJoined = spanNormalized.join("");
  if (!spanJoined) {
    return null;
  }

  const spanPhoneticJoined = spanNormalized.map(phoneticForm).join("");
  const isProperNoun = spanTokens.some((token) => token.isCapitalized || token.isAllCaps);
  const allTokensLookNameLike = spanTokens.every(
    (token) => token.isCapitalized || token.isAllCaps || LOWERCASE_NAME_CONNECTORS.has(token.normalized)
  );

  if (requireProperNoun && (!isProperNoun || !allTokensLookNameLike)) {
    return null;
  }

  let best: { player: PlayerEntry; score: number } | null = null;

  for (const player of players) {
    const tokenDistance = Math.abs(spanTokens.length - player.tokens.length);
    if (tokenDistance > 1) continue;

    const joinedScore = similarity(spanJoined, player.normalizedJoined);
    const phoneticScore = similarity(spanPhoneticJoined, player.phoneticJoined);
    const surnameScore = similarity(
      spanNormalized[spanNormalized.length - 1] || "",
      player.normalizedTokens[player.normalizedTokens.length - 1] || ""
    );

    const averageTokenScore =
      player.normalizedTokens.length > 0
        ? player.normalizedTokens.reduce((total, playerToken, index) => {
            const spanToken = spanNormalized[index] || spanNormalized[spanNormalized.length - 1] || "";
            return total + similarity(spanToken, playerToken);
          }, 0) / player.normalizedTokens.length
        : 0;

    const score = Math.max(
      joinedScore,
      (joinedScore + phoneticScore) / 2,
      (averageTokenScore + surnameScore) / 2
    );

    const threshold = isProperNoun ? 0.72 : 0.82;
    const strongEnough =
      score >= threshold ||
      (phoneticScore >= 0.9 && surnameScore >= 0.78) ||
      (joinedScore >= 0.7 && surnameScore >= 0.9);

    if (!strongEnough) continue;

    if (!best || score > best.score) {
      best = { player, score };
    }
  }

  return best;
}

function applySpanReplacements(text: string, tokens: WordToken[], replacements: Replacement[]) {
  if (replacements.length === 0) {
    return text;
  }

  const ordered = [...replacements].sort((left, right) => {
    if (left.startToken !== right.startToken) {
      return left.startToken - right.startToken;
    }

    const leftLength = left.endTokenExclusive - left.startToken;
    const rightLength = right.endTokenExclusive - right.startToken;
    if (leftLength !== rightLength) {
      return rightLength - leftLength;
    }

    return right.score - left.score;
  });

  const selected: Replacement[] = [];
  let lastEnd = -1;

  for (const replacement of ordered) {
    if (replacement.startToken < lastEnd) continue;
    selected.push(replacement);
    lastEnd = replacement.endTokenExclusive;
  }

  let cursor = 0;
  let output = "";

  for (const replacement of selected) {
    const start = tokens[replacement.startToken]?.start ?? cursor;
    const end = tokens[replacement.endTokenExclusive - 1]?.end ?? start;
    output += text.slice(cursor, start);
    output += replacement.replacement;
    cursor = end;
  }

  output += text.slice(cursor);
  return output;
}

function applyManualAliasCorrections(text: string, playerNames: string[]) {
  let nextText = text;

  for (const playerName of playerNames) {
    const aliases = MANUAL_ALIAS_OVERRIDES[playerName] ?? [];
    for (const alias of aliases) {
      const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      nextText = nextText.replace(pattern, playerName);
    }
  }

  return nextText;
}

function applySingleTokenCorrections(text: string, tokens: WordToken[], players: PlayerEntry[]) {
  const namePartMap = new Map<string, string>();

  for (const player of players) {
    for (const token of player.tokens) {
      const normalized = normalizeToken(token);
      if (!normalized) continue;

      const existing = namePartMap.get(normalized);
      if (!existing) {
        namePartMap.set(normalized, token);
      } else if (existing !== token) {
        namePartMap.set(normalized, "");
      }
    }
  }

  const replacements: Replacement[] = [];

  tokens.forEach((token, index) => {
    if (!token.normalized || (!token.isCapitalized && !token.isAllCaps)) {
      return;
    }

    let bestReplacement: { value: string; score: number } | null = null;

    for (const [normalizedNamePart, canonicalToken] of namePartMap.entries()) {
      if (!canonicalToken) continue;

      const score = Math.max(
        similarity(token.normalized, normalizedNamePart),
        similarity(phoneticForm(token.normalized), phoneticForm(normalizedNamePart))
      );

      if (score < 0.84) continue;

      if (!bestReplacement || score > bestReplacement.score) {
        bestReplacement = { value: canonicalToken, score };
      }
    }

    if (!bestReplacement || bestReplacement.value === token.value) {
      return;
    }

    replacements.push({
      startToken: index,
      endTokenExclusive: index + 1,
      replacement: bestReplacement.value,
      score: bestReplacement.score,
    });
  });

  return applySpanReplacements(text, tokens, replacements);
}

export function correctPlayerNamesInCommentary(text: string, playerNames: string[]) {
  if (!text.trim() || playerNames.length === 0) {
    return text;
  }

  const players = buildPlayerEntries(playerNames);
  if (players.length === 0) {
    return text;
  }

  let corrected = applyManualAliasCorrections(text, playerNames);
  let tokens = tokenizeWords(corrected);

  const spanReplacements: Replacement[] = [];

  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= 4; size += 1) {
      const end = start + size;
      if (end > tokens.length) continue;

      const spanTokens = tokens.slice(start, end);
      const bestMatch = chooseBestSpanMatch(spanTokens, players, size > 1);

      if (!bestMatch) continue;

      spanReplacements.push({
        startToken: start,
        endTokenExclusive: end,
        replacement: bestMatch.player.canonical,
        score: bestMatch.score,
      });
    }
  }

  corrected = applySpanReplacements(corrected, tokens, spanReplacements);
  tokens = tokenizeWords(corrected);
  corrected = applySingleTokenCorrections(corrected, tokens, players);

  return corrected;
}
