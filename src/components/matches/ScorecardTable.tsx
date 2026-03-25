import type { Scorecard } from "@/types/cricket";

interface ScorecardTableProps {
  scorecard: Scorecard;
}

export default function ScorecardTable({ scorecard }: ScorecardTableProps) {
  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-cg-dark border-b border-gray-800">
        <h3 className="text-white font-semibold">{scorecard.inning}</h3>
        <p className="text-cg-green text-sm font-bold">
          {scorecard.totalRuns}/{scorecard.totalWickets} ({scorecard.totalOvers} ov)
        </p>
      </div>

      {/* Batting */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs border-b border-gray-800">
              <th className="text-left px-4 py-2 font-medium">Batter</th>
              <th className="text-left px-2 py-2 font-medium hidden sm:table-cell">Dismissal</th>
              <th className="text-center px-2 py-2 font-medium">R</th>
              <th className="text-center px-2 py-2 font-medium">B</th>
              <th className="text-center px-2 py-2 font-medium">4s</th>
              <th className="text-center px-2 py-2 font-medium">6s</th>
              <th className="text-center px-2 py-2 font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.batting.map((entry) => (
              <tr
                key={entry.batsman.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="px-4 py-2 text-white font-medium">
                  {entry.batsman.name}
                  {entry.dismissal === "batting" && (
                    <span className="text-cg-green text-xs ml-1">*</span>
                  )}
                </td>
                <td className="px-2 py-2 text-gray-400 text-xs hidden sm:table-cell">
                  {entry.dismissal === "batting" ? "not out" : entry.dismissal}
                </td>
                <td className="text-center px-2 py-2 text-white font-bold">
                  {entry.r}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">{entry.b}</td>
                <td className="text-center px-2 py-2 text-gray-300">
                  {entry["4s"]}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">
                  {entry["6s"]}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">{entry.sr}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scorecard.extras && (
          <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-800">
            Extras: {scorecard.extras}
          </div>
        )}
      </div>

      {/* Bowling */}
      <div className="overflow-x-auto">
        <div className="px-4 py-2 bg-cg-dark border-b border-gray-800">
          <h4 className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
            Bowling
          </h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs border-b border-gray-800">
              <th className="text-left px-4 py-2 font-medium">Bowler</th>
              <th className="text-center px-2 py-2 font-medium">O</th>
              <th className="text-center px-2 py-2 font-medium">M</th>
              <th className="text-center px-2 py-2 font-medium">R</th>
              <th className="text-center px-2 py-2 font-medium">W</th>
              <th className="text-center px-2 py-2 font-medium">ECO</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.bowling.map((entry) => (
              <tr
                key={entry.bowler.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="px-4 py-2 text-white font-medium">
                  {entry.bowler.name}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">
                  {entry.o}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">
                  {entry.m}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">
                  {entry.r}
                </td>
                <td className="text-center px-2 py-2 text-white font-bold">
                  {entry.w}
                </td>
                <td className="text-center px-2 py-2 text-gray-300">
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
