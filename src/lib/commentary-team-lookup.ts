/**
 * Parse cricket team abbreviations / names from a commentary session title,
 * then fetch their rosters from SportMonks so Qwen has player context even
 * for test sessions that aren't tied to a real live match.
 *
 * Example: title "KKR vs MI - Test Session" → fetches KKR + MI rosters.
 */

// ── Known team codes (must match SportMonks `team.code` values) ─────────────
const KNOWN_CODES = new Set([
  // IPL
  "KKR", "MI", "CSK", "RCB", "DC", "SRH", "PBKS", "RR", "GT", "LSG",
  // International
  "IND", "AUS", "ENG", "PAK", "SA", "NZ", "WI", "SL", "BAN", "AFG",
  "ZIM", "IRE", "SCO", "NAM", "UAE", "OMA", "NEP", "PNG", "USA", "CAN",
  // CPL
  "TKR", "JAM", "GUY", "BAR", "SKN", "ANT",
  // BBL
  "STR", "MLR", "SYS", "SYT", "BRH", "PRS", "HBH", "ACT",
]);

// ── Partial name → code map ──────────────────────────────────────────────────
const NAME_FRAGMENTS: Record<string, string> = {
  "kolkata": "KKR", "knight rider": "KKR",
  "mumbai": "MI",
  "chennai": "CSK", "super king": "CSK",
  "bangalore": "RCB", "bengaluru": "RCB", "royal challenger": "RCB",
  "delhi": "DC", "capitals": "DC",
  "hyderabad": "SRH", "sunriser": "SRH",
  "punjab": "PBKS",
  "rajasthan": "RR", "royals": "RR",
  "gujarat": "GT", "titans": "GT",
  "lucknow": "LSG", "super giant": "LSG",
  "india": "IND",
  "australia": "AUS",
  "england": "ENG",
  "pakistan": "PAK",
  "south africa": "SA",
  "new zealand": "NZ",
  "west indie": "WI",
  "sri lanka": "SL",
  "bangladesh": "BAN",
  "afghanistan": "AFG",
  "zimbabwe": "ZIM",
  "ireland": "IRE",
  "scotland": "SCO",
};

/**
 * Extract team code hints (lowercase) from a session title.
 * e.g. "KKR vs MI - Test" → ["kkr", "mi"]
 */
export function extractTeamHintsFromTitle(title: string): string[] {
  const hints = new Set<string>();

  // 1. Word-based: look for all-caps tokens matching known codes
  const words = title.split(/[\s\-–—vs.,|&/()"']+/).filter(Boolean);
  for (const word of words) {
    const upper = word.toUpperCase().replace(/[^A-Z]/g, "");
    if (upper.length >= 2 && upper.length <= 6 && KNOWN_CODES.has(upper)) {
      hints.add(upper.toLowerCase());
    }
  }

  // 2. Full-name fragments
  const lower = title.toLowerCase();
  for (const [fragment, code] of Object.entries(NAME_FRAGMENTS)) {
    if (lower.includes(fragment)) {
      hints.add(code.toLowerCase());
    }
  }

  return [...hints];
}
