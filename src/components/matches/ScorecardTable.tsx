import type { Scorecard } from "@/types/cricket";

interface ScorecardTableProps {
  scorecard: Scorecard;
}

export default function ScorecardTable({ scorecard }: ScorecardTableProps) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#171a1b]">
      <div className="border-b border-white/8 bg-[#151819] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8e887d]">Innings</p>
        <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-white">{scorecard.inning}</h3>
        <p className="mt-1 text-sm font-semibold text-[#31d260]">
          {scorecard.totalRuns}/{scorecard.totalWickets} ({scorecard.totalOvers} ov)
        </p>
      </div>

      {/* Batting */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-[11px] uppercase tracking-[0.18em] text-[#8e887d]">
              <th className="px-5 py-3 text-left font-semibold">Batters</th>
              <th className="hidden px-3 py-3 text-left font-semibold sm:table-cell">Dismissal</th>
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
                className="border-b border-white/6 hover:bg-white/[0.025]"
              >
                <td className="px-5 py-3 text-white font-semibold">
                  {entry.batsman.name}
                  {entry.dismissal === "batting" && (
                    <span className="ml-1 text-xs text-[#31d260]">*</span>
                  )}
                </td>
                <td className="hidden px-3 py-3 text-xs text-[#b5b0a5] sm:table-cell">
                  {entry.dismissal === "batting" ? "not out" : entry.dismissal}
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
          <div className="border-b border-white/8 px-5 py-3 text-xs uppercase tracking-[0.14em] text-[#8e887d]">
            Extras: {scorecard.extras}
          </div>
        )}
      </div>

      {/* Bowling */}
      <div className="overflow-x-auto">
        <div className="border-b border-white/8 bg-[#151819] px-5 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8e887d]">
            Bowling
          </h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-[11px] uppercase tracking-[0.18em] text-[#8e887d]">
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
                className="border-b border-white/6 hover:bg-white/[0.025]"
              >
                <td className="px-5 py-3 font-semibold text-white">
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
                <td className="px-3 py-3 text-center font-bold text-white">
                  {entry.w}
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
