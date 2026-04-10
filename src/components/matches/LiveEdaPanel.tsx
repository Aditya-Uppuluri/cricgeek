"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Activity, Loader2, TriangleAlert } from "lucide-react";
import EdaCards from "@/components/matches/EdaCards";
import LiveEdaCharts from "@/components/matches/LiveEdaCharts";
import type { LiveEdaReport } from "@/types/eda";
import { LIVE_EDA_POLL_INTERVAL_SECONDS } from "@/lib/eda/live";

type LiveEdaPanelProps = {
  matchId: string;
  enabled: boolean;
};

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; detail?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || payload?.detail || "Request failed");
  }

  return payload as T;
}

export default function LiveEdaPanel({ matchId, enabled }: LiveEdaPanelProps) {
  const [report, setReport] = useState<LiveEdaReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadReport = useEffectEvent(async (signal?: AbortSignal) => {
    setLoading(true);

    try {
      const payload = await readJson<LiveEdaReport>(`/api/eda/live?matchId=${encodeURIComponent(matchId)}`, {
        cache: "no-store",
        signal,
      });

      setReport(payload);
      setError(null);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Unable to load live intelligence right now.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!enabled) {
      setReport(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void loadReport(controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, matchId]);

  useEffect(() => {
    if (!enabled) return;

    const interval = window.setInterval(() => {
      void loadReport();
    }, LIVE_EDA_POLL_INTERVAL_SECONDS * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, matchId]);

  if (!enabled) {
    return (
      <section className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
        <h3 className="text-lg font-bold text-white">Live Intelligence</h3>
        <p className="mt-2 text-sm text-gray-400">
          Live EDA unlocks as soon as the match starts and score state begins flowing in from the provider.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-800 bg-cg-dark-2 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cg-green/20 bg-cg-green/10 text-cg-green">
              <Activity size={16} />
            </span>
            <h3 className="text-lg font-bold text-white">Live Intelligence</h3>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Deterministic live pressure analysis with venue context, plus the specialist T20 advisor when it is available.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          <span className="rounded-full bg-white/5 px-3 py-1.5">
            Auto-refresh every {report?.pollIntervalSeconds ?? LIVE_EDA_POLL_INTERVAL_SECONDS}s
          </span>
          {report ? (
            <span className="rounded-full bg-white/5 px-3 py-1.5">
              {report.ballsTracked} balls tracked
            </span>
          ) : null}
          {report ? (
            <span className="rounded-full bg-white/5 px-3 py-1.5">
              Confidence {Math.round(report.confidence.score)}% | {report.confidence.label}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {!report && !loading ? (
        <div className="mt-4 rounded-lg border border-gray-800 bg-cg-dark px-4 py-4 text-sm text-gray-400">
          Waiting for the current live state to generate the first EDA snapshot.
        </div>
      ) : null}

      {report ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-4">
            <p className="text-sm leading-7 text-gray-200">{report.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="rounded-full bg-white/5 px-3 py-1.5">
                Phase {report.snapshot.phase}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1.5">
                {report.snapshot.battingTeam} {report.snapshot.runs}/{report.snapshot.wickets}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1.5">
                Generated {new Date(report.freshness.generatedAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Kolkata",
                })}
              </span>
            </div>
          </div>

          <EdaCards cards={report.cards} />
          <LiveEdaCharts analytics={report.analytics} />

          {report.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <TriangleAlert size={16} className="text-amber-200" />
                <p className="text-sm font-semibold text-amber-100">Operational notes</p>
              </div>
              <div className="mt-3 space-y-2">
                {report.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-amber-200">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {report.advisor ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-4">
                <h4 className="text-sm font-semibold text-white">Batting recommendations</h4>
                <div className="mt-3 space-y-3">
                  {report.advisor.battingRecommendations.slice(0, 3).map((item) => (
                    <div key={`${item.player}-${item.team}`} className="rounded-lg border border-gray-800 bg-cg-dark-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{item.player}</p>
                        <span className="text-xs text-cg-green">Fit {Math.round(item.situationSuitability)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{item.team}</p>
                      <p className="mt-2 text-sm text-gray-400">
                        {item.reasons[0] || "Recommended for the current match state."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-cg-dark px-4 py-4">
                <h4 className="text-sm font-semibold text-white">Bowling recommendations</h4>
                <div className="mt-3 space-y-3">
                  {report.advisor.bowlingRecommendations.slice(0, 3).map((item) => (
                    <div key={`${item.player}-${item.team}`} className="rounded-lg border border-gray-800 bg-cg-dark-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{item.player}</p>
                        <span className="text-xs text-cg-green">Utility {Math.round(item.utilityScore)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{item.team}</p>
                      <p className="mt-2 text-sm text-gray-400">
                        {item.reasons[0] || "Recommended for the current match state."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
