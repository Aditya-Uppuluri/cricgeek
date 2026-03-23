import type { SeriesItem } from "@/hooks/useSeries";

function seriesStatus(startDate: string, endDate: string): "upcoming" | "ongoing" | "completed" {
  const now   = Date.now();
  const start = new Date(startDate).getTime();
  // endDate can be partial ("Apr 11"), so try to parse; fallback to startDate
  const end   = new Date(endDate).getTime();
  const endTs = isNaN(end) ? start : end + 24 * 60 * 60 * 1000;

  if (now < start)  return "upcoming";
  if (now <= endTs) return "ongoing";
  return "completed";
}

const STATUS_STYLE = {
  ongoing:   "bg-green-500/10 text-green-400 border-green-500/30",
  upcoming:  "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  completed: "bg-gray-700/50 text-gray-400 border-gray-600/30",
};

const STATUS_LABEL = {
  ongoing:   "Ongoing",
  upcoming:  "Upcoming",
  completed: "Completed",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // return as-is if unparseable
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function SeriesCard({ series }: { series: SeriesItem }) {
  const status = seriesStatus(series.startDate, series.endDate);

  const formats: { label: string; count: number }[] = [
    { label: "Test", count: series.test },
    { label: "ODI",  count: series.odi  },
    { label: "T20",  count: series.t20  },
  ].filter((f) => f.count > 0);

  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-all flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-white font-semibold text-sm leading-snug">{series.name}</h3>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Format pills */}
      {formats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {formats.map((f) => (
            <span key={f.label} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-700/60 text-gray-300">
              {f.label} · {f.count}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-800/70 text-xs text-gray-500">
        <span>{formatDate(series.startDate)} — {series.endDate}</span>
        <span>{series.matches} match{series.matches !== 1 ? "es" : ""}</span>
      </div>
    </div>
  );
}
