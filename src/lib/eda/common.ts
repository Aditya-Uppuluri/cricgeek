import type { Match } from "@/types/cricket";
import type { EdaConfidence, EdaConfidenceLabel, EdaFreshness, EdaSourceReference } from "@/types/eda";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return round((part / total) * 100, 1);
}

export function deriveMatchState(match: Match): EdaFreshness["matchState"] {
  if (match.matchEnded) return "completed";
  if (match.matchStarted) return "live";
  if (match.dateTimeGMT || match.date) return "scheduled";
  return "unknown";
}

export function deriveCompetitionLabel(match: Match) {
  const competitionMatch = match.name.match(/\(([^)]+)\)\s*$/);
  return competitionMatch?.[1]?.trim() || null;
}

export function getScheduledOvers(matchType: string) {
  const raw = matchType.trim().toLowerCase();
  if (!raw) return null;

  if (raw.includes("t10")) return 10;
  if (raw.includes("t20") || raw.includes("it20")) return 20;
  if (raw.includes("odi") || raw.includes("one day")) return 50;

  return null;
}

export function warehouseMatchType(matchType: string) {
  const raw = matchType.trim().toUpperCase();
  if (raw === "TEST") return "TEST";
  if (raw === "ODI" || raw === "ODI-W") return "ODI";
  if (raw === "T20I" || raw === "IT20") return "T20I";
  if (raw.includes("T20")) return "T20";
  if (raw === "FC") return "FC";
  return raw;
}

export function confidenceLabel(score: number): EdaConfidenceLabel {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function buildConfidence(score: number, reasons: string[]): EdaConfidence {
  const normalized = clamp(round(score, 1), 0, 100);
  return {
    score: normalized,
    label: confidenceLabel(normalized),
    reasons,
  };
}

export function buildFreshness(input: {
  match: Match;
  historicalAvailable: boolean;
  newsUpdatedAt?: string | null;
  notes?: string[];
}): EdaFreshness {
  return {
    generatedAt: new Date().toISOString(),
    matchState: deriveMatchState(input.match),
    historicalAvailable: input.historicalAvailable,
    newsUpdatedAt: input.newsUpdatedAt ?? null,
    notes: input.notes ?? [],
  };
}

export function dedupeSources<T extends EdaSourceReference>(sources: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const source of sources) {
    const key = `${source.type}:${source.url || source.title}:${source.note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(source);
  }

  return output;
}

export function inferPhase(overOrOvers: number, matchType?: string) {
  const over = Math.floor(overOrOvers);
  const scheduledOvers = matchType ? getScheduledOvers(matchType) : null;

  if (scheduledOvers === 10) {
    if (over < 3) return "Powerplay";
    if (over < 8) return "Middle";
    return "Death";
  }

  if (scheduledOvers === 20) {
    if (over < 6) return "Powerplay";
    if (over < 16) return "Middle";
    return "Death";
  }

  if (scheduledOvers === 50) {
    if (over < 10) return "Powerplay";
    if (over < 40) return "Middle";
    return "Death";
  }

  if (scheduledOvers) {
    const progress = overOrOvers / scheduledOvers;
    if (progress < 0.25) return "Opening phase";
    if (progress < 0.8) return "Middle phase";
    return "Closing phase";
  }

  if (over < 15) return "Opening spell";
  if (over < 60) return "Middle spell";
  return "Old-ball spell";
}
