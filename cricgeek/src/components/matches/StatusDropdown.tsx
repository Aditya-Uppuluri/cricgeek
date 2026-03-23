"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusFilter = "all" | "live" | "upcoming" | "completed";

const OPTIONS: { value: StatusFilter; label: string; dot: string }[] = [
  { value: "all",       label: "All Status",  dot: "bg-gray-500" },
  { value: "live",      label: "Live",        dot: "bg-red-500 animate-pulse" },
  { value: "upcoming",  label: "Upcoming",    dot: "bg-yellow-400" },
  { value: "completed", label: "Completed",   dot: "bg-green-500" },
];

interface Props {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}

export default function StatusDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = OPTIONS.find(o => o.value === value) ?? OPTIONS[0];

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
          open || value !== "all"
            ? "bg-gray-700 border-cg-green text-white"
            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
        )}
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", selected.dot)} />
        {selected.label}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors",
                opt.value === value
                  ? "bg-cg-green/10 text-cg-green"
                  : "text-gray-300 hover:bg-gray-800"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", opt.dot)} />
              <span className="flex-1 text-left">{opt.label}</span>
              {opt.value === value && <Check size={11} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
