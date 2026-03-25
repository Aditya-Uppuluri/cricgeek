import type { Commentary } from "@/types/cricket";

interface CommentaryFeedProps {
  commentary: Commentary;
}

export default function CommentaryFeed({ commentary }: CommentaryFeedProps) {
  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-cg-dark border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white font-semibold">Ball-by-Ball Commentary</h3>
        <span className="text-xs text-gray-400">
          {commentary.bbb.length} entries
        </span>
      </div>
      <div className="divide-y divide-gray-800/50 max-h-[500px] overflow-y-auto">
        {commentary.bbb.map((ball) => (
          <div key={ball.id} className="px-4 py-3 hover:bg-gray-800/20">
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  ball.score === 4
                    ? "bg-blue-500/20 text-blue-400"
                    : ball.score === 6
                    ? "bg-green-500/20 text-green-400"
                    : ball.score === 0
                    ? "bg-gray-700 text-gray-400"
                    : "bg-gray-600 text-white"
                }`}
              >
                {ball.score === 0 ? "•" : ball.score}
              </div>
              <div>
                <p className="text-white text-sm">{ball.commentary}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {ball.bowler} to {ball.batsman}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
