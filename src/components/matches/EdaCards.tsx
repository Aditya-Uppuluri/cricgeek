"use client";

import type { PostMatchEdaCard } from "@/types/cricket";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EdaCardsProps {
  cards: PostMatchEdaCard[];
}

// ── Helper: pick icon for tone ─────────────────────────────────────────────
function ToneIcon({ tone }: { tone?: string }) {
  if (tone === "good") return <TrendingUp size={12} className="text-emerald-400 flex-shrink-0" />;
  if (tone === "warning") return <TrendingDown size={12} className="text-amber-400 flex-shrink-0" />;
  return <Minus size={12} className="text-gray-600 flex-shrink-0" />;
}

// ── Gauge / probability bar ────────────────────────────────────────────────
function ProbabilityGauge({ value, ci95 }: { value: number; ci95?: [number, number] }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 65
      ? "from-emerald-500 to-emerald-400"
      : pct <= 35
        ? "from-amber-500 to-amber-400"
        : "from-violet-500 to-violet-400";

  return (
    <div className="mt-3 space-y-1.5">
      {/* Track */}
      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* CI band */}
      {ci95 && (
        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <span>{ci95[0]}%</span>
          <span className="text-gray-500">95% CI</span>
          <span>{ci95[1]}%</span>
        </div>
      )}
    </div>
  );
}

// ── Resource / RPI bar ─────────────────────────────────────────────────────
function MeterBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Cascade risk ring ──────────────────────────────────────────────────────
function RiskRing({ risk }: { risk: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (risk / 100) * circ;
  const color = risk >= 40 ? "#f59e0b" : risk >= 20 ? "#8b5cf6" : "#10b981";

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>
        {risk}%
      </text>
    </svg>
  );
}

// ── Card type detection ─────────────────────────────────────────────────────

function parseNumericValue(v: string): number | null {
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : null;
}

function extractCI95(subValue?: string): [number, number] | undefined {
  if (!subValue) return undefined;
  const match = subValue.match(/([\d.]+)\u2013([\d.]+)/);
  if (!match) return undefined;
  return [parseFloat(match[1]!), parseFloat(match[2]!)];
}

// ── Card renderers ─────────────────────────────────────────────────────────

function WinProbabilityCard({ card }: { card: PostMatchEdaCard }) {
  const prob = parseNumericValue(card.value) ?? 50;
  const ci95 = extractCI95((card as unknown as Record<string, unknown>).subValue as string | undefined);

  return (
    <div className="rounded-xl border border-violet-500/25 bg-gradient-to-br from-[#1a1035]/80 to-[#0f0b22]/80 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/80">{card.label}</p>
        <ToneIcon tone={card.tone} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-black text-white">{card.value}</p>
        {ci95 && (
          <span className="text-[11px] text-gray-500">±{Math.round((ci95[1] - ci95[0]) / 2)}%</span>
        )}
      </div>
      <ProbabilityGauge value={prob} ci95={ci95} />
      <p className="mt-3 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

function ResourceCard({ card }: { card: PostMatchEdaCard }) {
  const val = parseNumericValue(card.value) ?? 0;
  const color = val >= 50 ? "bg-emerald-500" : val >= 25 ? "bg-violet-500" : "bg-amber-500";
  return (
    <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
        <ToneIcon tone={card.tone} />
      </div>
      <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
      <MeterBar value={val} color={color} />
      <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

function CascadeRiskCard({ card }: { card: PostMatchEdaCard }) {
  const risk = parseNumericValue(card.value) ?? 0;
  return (
    <div className={cn(
      "rounded-xl border p-4",
      risk >= 40 ? "border-amber-500/25 bg-amber-500/5" : "border-gray-800 bg-cg-dark-2",
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <RiskRing risk={risk} />
        <div>
          <p className="text-xl font-black text-white">{card.value}</p>
          <p className="text-[10px] text-gray-500">next 3 overs</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

function MomentumCard({ card }: { card: PostMatchEdaCard }) {
  const raw = card.value.replace("/100", "").trim();
  const val = parseNumericValue(raw) ?? 50;
  const delta = val - 50;
  const barColor = val >= 60 ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
    : val <= 40 ? "bg-gradient-to-r from-amber-600 to-amber-400"
    : "bg-gradient-to-r from-violet-600 to-violet-400";

  return (
    <div className="rounded-xl border border-gray-800 bg-cg-dark-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
        {delta > 5
          ? <TrendingUp size={12} className="text-emerald-400 flex-shrink-0" />
          : delta < -5
            ? <TrendingDown size={12} className="text-amber-400 flex-shrink-0" />
            : <Minus size={12} className="text-gray-600 flex-shrink-0" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-black text-white">{val}</p>
        <span className="text-xs text-gray-500">/100</span>
        {Math.abs(delta) > 3 && (
          <span className={cn("text-xs font-semibold", delta > 0 ? "text-emerald-400" : "text-amber-400")}>
            {delta > 0 ? "+" : ""}{delta.toFixed(0)}
          </span>
        )}
      </div>
      {/* Bi-directional bar centred at 50 */}
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 relative overflow-hidden">
        {delta >= 0
          ? <div className={cn("absolute h-full rounded-r-full", barColor)} style={{ left: "50%", width: `${Math.min(50, delta)}%` }} />
          : <div className={cn("absolute h-full rounded-l-full", barColor)} style={{ right: "50%", width: `${Math.min(50, -delta)}%` }} />}
        <div className="absolute h-full w-px bg-white/20" style={{ left: "50%" }} />
      </div>
      <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

function DeathForecastCard({ card }: { card: PostMatchEdaCard }) {
  const isInDeath = card.value === "In death overs";
  return (
    <div className={cn(
      "rounded-xl border p-4",
      card.tone === "good" ? "border-emerald-500/20 bg-emerald-500/5" : "border-gray-800 bg-cg-dark-2"
    )}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <p className={cn("text-2xl font-black", isInDeath ? "text-gray-400" : "text-white")}>{card.value}</p>
        {!isInDeath && <span className="text-sm text-gray-500">runs</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

function RpiCard({ card }: { card: PostMatchEdaCard }) {
  const val = parseNumericValue(card.value) ?? 50;
  const color = val >= 60 ? "bg-emerald-500" : val <= 40 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className={cn(
      "rounded-xl border p-4",
      val >= 60 ? "border-emerald-500/20 bg-emerald-500/5"
        : val <= 40 ? "border-amber-500/20 bg-amber-500/5"
        : "border-gray-800 bg-cg-dark-2"
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
        <ToneIcon tone={card.tone} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <p className="text-2xl font-black text-white">{val}</p>
        <span className="text-xs text-gray-500">/100</span>
      </div>
      <MeterBar value={val} color={color} />
      <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

// Default card for all legacy metrics
function DefaultCard({ card }: { card: PostMatchEdaCard }) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      card.tone === "good" && "border-emerald-500/20 bg-emerald-500/5",
      card.tone === "warning" && "border-amber-500/20 bg-amber-500/5",
      (!card.tone || card.tone === "neutral") && "border-gray-800 bg-cg-dark-2"
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
        <ToneIcon tone={card.tone} />
      </div>
      <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
      <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">{card.insight}</p>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function EdaCards({ cards }: EdaCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        switch (card.id) {
          case "win-probability":
            return <WinProbabilityCard key={card.id} card={card} />;
          case "dls-resources":
            return <ResourceCard key={card.id} card={card} />;
          case "rpi":
            return <RpiCard key={card.id} card={card} />;
          case "entropy-momentum":
            return <MomentumCard key={card.id} card={card} />;
          case "cascade-risk":
            return <CascadeRiskCard key={card.id} card={card} />;
          case "death-forecast":
            return <DeathForecastCard key={card.id} card={card} />;
          default:
            return <DefaultCard key={card.id} card={card} />;
        }
      })}
    </div>
  );
}
