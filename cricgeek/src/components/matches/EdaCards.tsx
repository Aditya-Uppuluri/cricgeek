import type { PostMatchEdaCard } from "@/types/cricket";
import { cn } from "@/lib/utils";

interface EdaCardsProps {
  cards: PostMatchEdaCard[];
}

export default function EdaCards({ cards }: EdaCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className={cn(
            "rounded-xl border p-4",
            card.tone === "good" && "border-cg-green/20 bg-cg-green/5",
            card.tone === "warning" && "border-amber-500/20 bg-amber-500/5",
            (!card.tone || card.tone === "neutral") && "border-gray-800 bg-cg-dark-2"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
          <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
          <p className="mt-2 text-sm text-gray-400">{card.insight}</p>
        </div>
      ))}
    </div>
  );
}
