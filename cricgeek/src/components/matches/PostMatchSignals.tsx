import type { PostMatchSignal } from "@/types/cricket";
import { cn } from "@/lib/utils";

interface PostMatchSignalsProps {
  signals: PostMatchSignal[];
}

export default function PostMatchSignals({ signals }: PostMatchSignalsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {signals.map((signal) => (
        <div
          key={signal.id}
          className={cn(
            "rounded-xl border p-4",
            signal.tone === "good" && "border-cg-green/20 bg-cg-green/5",
            signal.tone === "warning" && "border-amber-500/20 bg-amber-500/5",
            (!signal.tone || signal.tone === "neutral") && "border-gray-800 bg-cg-dark-2"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{signal.label}</p>
          <p className="mt-2 text-xl font-black text-white">{signal.value}</p>
          <p className="mt-2 text-sm text-gray-400">{signal.insight}</p>
        </div>
      ))}
    </div>
  );
}
