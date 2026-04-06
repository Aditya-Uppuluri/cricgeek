import type { Scorecard } from "@/types/cricket";

interface ScorecardTableProps {
  scorecard: Scorecard;
}

// ── Dismissal parser ─────────────────────────────────────────────────────────
// Parses a raw dismissal string into structured parts for rich rendering.
// Handles: "c X b Y", "c & b X", "lbw b X", "b X", "run out (X)", "st X b Y",
//          "hit wicket b X", "batting" (not out), "not out", "did not bat"

type DismissalPart =
  | { kind: "label"; text: string }   // "c", "b", "lbw b", "run out", etc.
  | { kind: "fielder"; text: string } // catcher / keeper / runner
  | { kind: "bowler"; text: string }; // bowler name

function parseDismissal(raw: string): DismissalPart[] | null {
  const s = raw.trim().toLowerCase();

  // Not out states — caller handles these separately
  if (s === "batting" || s === "not out" || s === "did not bat" || s === "") {
    return null;
  }

  // Plain "out" (no further info)
  if (s === "out") {
    return [{ kind: "label", text: "out" }];
  }

  const original = raw.trim();

  // c & b X  (caught & bowled)
  const cAndB = original.match(/^c\s*&\s*b\s+(.+)$/i);
  if (cAndB) {
    return [
      { kind: "label", text: "c & b" },
      { kind: "bowler", text: cAndB[1].trim() },
    ];
  }

  // c X b Y  (caught fielder bowled bowler)
  const caught = original.match(/^c\s+(.+?)\s+b\s+(.+)$/i);
  if (caught) {
    return [
      { kind: "label", text: "c" },
      { kind: "fielder", text: caught[1].trim() },
      { kind: "label", text: "b" },
      { kind: "bowler", text: caught[2].trim() },
    ];
  }

  // st X b Y  (stumped)
  const stumped = original.match(/^st\s+(.+?)\s+b\s+(.+)$/i);
  if (stumped) {
    return [
      { kind: "label", text: "st" },
      { kind: "fielder", text: stumped[1].trim() },
      { kind: "label", text: "b" },
      { kind: "bowler", text: stumped[2].trim() },
    ];
  }

  // lbw b X
  const lbw = original.match(/^lbw\s+b\s+(.+)$/i);
  if (lbw) {
    return [
      { kind: "label", text: "lbw b" },
      { kind: "bowler", text: lbw[1].trim() },
    ];
  }

  // b X  (bowled)
  const bowled = original.match(/^b\s+(.+)$/i);
  if (bowled) {
    return [
      { kind: "label", text: "b" },
      { kind: "bowler", text: bowled[1].trim() },
    ];
  }

  // run out (X)
  const runOut = original.match(/^run\s+out\s*(?:\((.+)\))?$/i);
  if (runOut) {
    const parts: DismissalPart[] = [{ kind: "label", text: "run out" }];
    if (runOut[1]) parts.push({ kind: "fielder", text: runOut[1].trim() });
    return parts;
  }

  // hit wicket b X
  const hitWicket = original.match(/^hit\s+wicket\s+b\s+(.+)$/i);
  if (hitWicket) {
    return [
      { kind: "label", text: "hit wicket b" },
      { kind: "bowler", text: hitWicket[1].trim() },
    ];
  }

  // Fallback — render as plain label
  return [{ kind: "label", text: original }];
}

function DismissalCell({ dismissal }: { dismissal: string }) {
  const isNotOut =
    dismissal === "batting" || dismissal === "not out" || dismissal === "did not bat";

  if (isNotOut) {
    return (
      <span className="text-[#31d260] text-xs font-medium">
        {dismissal === "did not bat" ? "did not bat" : "not out"}
      </span>
    );
  }

  const parts = parseDismissal(dismissal);

  if (!parts) {
    return <span className="text-[#8e887d] text-xs">—</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 text-xs leading-snug">
      {parts.map((part, i) => {
        if (part.kind === "label") {
          return (
            <span key={i} className="text-[#7a7570] font-normal">
              {part.text}
            </span>
          );
        }
        if (part.kind === "fielder") {
          return (
            <span key={i} className="text-[#c5bfb5] font-medium">
              {part.text}
            </span>
          );
        }
        // bowler
        return (
          <span key={i} className="text-[#e8e3db] font-semibold">
            {part.text}
          </span>
        );
      })}
    </span>
  );
}

export default function ScorecardTable({ scorecard }: ScorecardTableProps) {
  return (
    <div className="overflow-hidden">
      {/* Batting */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-[10px] uppercase tracking-[0.18em] text-[#8e887d]">
              <th className="px-5 py-3 text-left font-semibold">Batters</th>
              <th className="px-3 py-3 text-left font-semibold">Dismissal</th>
              <th className="px-3 py-3 text-center font-semibold">R</th>
              <th className="px-3 py-3 text-center font-semibold">B</th>
              <th className="px-3 py-3 text-center font-semibold">4s</th>
              <th className="px-3 py-3 text-center font-semibold">6s</th>
              <th className="px-3 py-3 text-center font-semibold">SR</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.batting.map((entry) => (
              <tr
                key={entry.batsman.id}
                className="border-b border-white/6 hover:bg-white/[0.025] transition-colors"
              >
                <td className="px-5 py-3 text-white font-semibold whitespace-nowrap">
                  {entry.batsman.name}
                  {entry.dismissal === "batting" && (
                    <span className="ml-1 text-xs text-[#31d260]">*</span>
                  )}
                </td>
                <td className="px-3 py-3 max-w-[200px]">
                  <DismissalCell dismissal={entry.dismissal} />
                </td>
                <td className="px-3 py-3 text-center font-bold text-white">
                  {entry.r}
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">{entry.b}</td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">
                  {entry["4s"]}
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">
                  {entry["6s"]}
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">{entry.sr}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scorecard.extras && (
          <div className="border-b border-white/8 px-5 py-3 text-xs text-[#8e887d]">
            <span className="uppercase tracking-[0.14em]">Extras</span>
            <span className="ml-2 text-[#b5afa5]">{scorecard.extras}</span>
          </div>
        )}
      </div>

      {/* Bowling */}
      <div className="overflow-x-auto">
        <div className="border-y border-white/8 bg-[#151819] px-5 py-2.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8e887d]">
            Bowling
          </h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-[10px] uppercase tracking-[0.18em] text-[#8e887d]">
              <th className="px-5 py-3 text-left font-semibold">Bowlers</th>
              <th className="px-3 py-3 text-center font-semibold">O</th>
              <th className="px-3 py-3 text-center font-semibold">M</th>
              <th className="px-3 py-3 text-center font-semibold">R</th>
              <th className="px-3 py-3 text-center font-semibold">W</th>
              <th className="px-3 py-3 text-center font-semibold">ECON</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.bowling.map((entry) => (
              <tr
                key={entry.bowler.id}
                className="border-b border-white/6 hover:bg-white/[0.025] transition-colors"
              >
                <td className="px-5 py-3 font-semibold text-white whitespace-nowrap">
                  {entry.bowler.name}
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">
                  {entry.o}
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">
                  {entry.m}
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">
                  {entry.r}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={
                      entry.w > 0
                        ? "font-bold text-[#31d260]"
                        : "text-[#c5c0b6]"
                    }
                  >
                    {entry.w}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-[#c5c0b6]">
                  {entry.eco}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
