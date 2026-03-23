"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

interface Props {
  label: string;
  value: string;       // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(ymd: string) {
  if (!ymd) return null;
  const d = parseYMD(ymd);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function DatePickerDropdown({ label, value, onChange }: Props) {
  const today      = new Date();
  const initDate   = value ? parseYMD(value) : today;
  const [viewYear, setViewYear]   = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Build calendar grid
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const todayYMD    = toYMD(today);
  const selectedYMD = value;

  function selectDay(day: number) {
    const chosen = toYMD(new Date(viewYear, viewMonth, day));
    if (chosen === selectedYMD) { onChange(""); }   // click again to deselect
    else { onChange(chosen); setOpen(false); }
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
          open || value
            ? "bg-gray-700 border-cg-green text-white"
            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
        )}
      >
        <CalendarDays size={13} className={value ? "text-cg-green" : ""} />
        <span className="text-xs">{label}</span>
        {value ? (
          <>
            <span className="text-white font-medium text-xs">{formatDisplay(value)}</span>
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="ml-1 text-gray-500 hover:text-white"
            >
              <X size={11} />
            </span>
          </>
        ) : (
          <span className="text-gray-600 text-xs">Pick date</span>
        )}
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const ymd     = toYMD(new Date(viewYear, viewMonth, day));
              const isToday = ymd === todayYMD;
              const isSel   = ymd === selectedYMD;
              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs transition-colors",
                    isSel  && "bg-cg-green text-black font-bold",
                    !isSel && isToday && "border border-cg-green text-cg-green",
                    !isSel && !isToday && "text-gray-300 hover:bg-gray-700"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
