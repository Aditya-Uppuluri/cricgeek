function normalizeToken(token: string) {
  return token.toLowerCase().replace(/[^a-z]/g, "");
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

function tokenize(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

function restoreLeadingCase(originalWord: string, canonicalWord: string) {
  if (originalWord.toUpperCase() === originalWord) {
    return canonicalWord.toUpperCase();
  }

  if (originalWord[0] && originalWord[0] === originalWord[0].toUpperCase()) {
    return canonicalWord;
  }

  return canonicalWord;
}

export function correctPlayerNamesInCommentary(text: string, playerNames: string[]) {
  if (!text.trim() || playerNames.length === 0) {
    return text;
  }

  const words = tokenize(text);
  if (words.length === 0) {
    return text;
  }

  const players = playerNames
    .map((name) => ({
      canonical: name,
      tokens: name.split(/\s+/).filter(Boolean),
      normalizedTokens: name.split(/\s+/).map(normalizeToken).filter(Boolean),
      normalizedJoined: normalizeToken(name),
    }))
    .filter((player) => player.tokens.length > 0);

  const usedIndexes = new Set<number>();

  for (const player of players) {
    const targetLength = player.tokens.length;
    const surname = player.normalizedTokens[player.normalizedTokens.length - 1] || "";

    for (let start = 0; start < words.length; start += 1) {
      if (usedIndexes.has(start)) continue;

      for (const size of [targetLength, targetLength + 1, Math.max(1, targetLength - 1)]) {
        const end = start + size;
        if (end > words.length) continue;
        if ([...Array(size).keys()].some((offset) => usedIndexes.has(start + offset))) continue;

        const windowWords = words.slice(start, end);
        const normalizedWindowWords = windowWords.map(normalizeToken).filter(Boolean);
        const normalizedJoined = normalizedWindowWords.join("");
        if (!normalizedJoined) continue;

        const joinedScore = similarity(normalizedJoined, player.normalizedJoined);
        const surnameCandidate = normalizedWindowWords[normalizedWindowWords.length - 1] || normalizedJoined;
        const surnameScore = surname ? similarity(surnameCandidate, surname) : 0;

        const tokenScores = player.normalizedTokens.map((token, index) =>
          similarity(normalizedWindowWords[index] || "", token)
        );
        const averageTokenScore =
          tokenScores.length > 0
            ? tokenScores.reduce((total, score) => total + score, 0) / tokenScores.length
            : 0;

        const hasStrongMatch =
          joinedScore >= 0.82 ||
          (joinedScore >= 0.74 && surnameScore >= 0.86) ||
          (averageTokenScore >= 0.78 && surnameScore >= 0.78);

        if (!hasStrongMatch) continue;

        const replacement = player.tokens
          .map((token, index) => restoreLeadingCase(windowWords[index] || token, token))
          .join(" ");

        words.splice(start, size, replacement);

        for (let index = start; index < start + 1; index += 1) {
          usedIndexes.add(index);
        }

        break;
      }
    }
  }

  return words.join(" ");
}
