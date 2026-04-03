"use client";

import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, ChevronDown, Clock3 } from "lucide-react";

interface Entry {
  id: string;
  text: string;
  overText: string | null;
  source: string;
  createdAt: string;
}

interface LiveCommentaryFeedProps {
  sessionId: string;
  initialEntries: Entry[];
  sessionStatus: string;
}

export default function LiveCommentaryFeed({
  sessionId,
  initialEntries,
  sessionStatus,
}: LiveCommentaryFeedProps) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  // Connect to SSE stream
  useEffect(() => {
    if (sessionStatus === "ended") return;

    const eventSource = new EventSource(
      `/api/commentary/${sessionId}/stream`
    );

    eventSource.addEventListener("connected", () => {
      setConnected(true);
    });

    eventSource.addEventListener("entry", (e) => {
      const entry: Entry = JSON.parse(e.data);
      setEntries((prev) => {
        // Dedup by id
        if (prev.some((p) => p.id === entry.id)) return prev;
        return [entry, ...prev];
      });
      if (!autoScroll) {
        setNewCount((c) => c + 1);
      }
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [sessionId, sessionStatus, autoScroll]);

  // Auto-scroll to top (newest first) when new entries arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [entries, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!feedRef.current) return;
    const isAtTop = feedRef.current.scrollTop < 10;
    setAutoScroll(isAtTop);
    if (isAtTop) setNewCount(0);
  };

  const scrollToTop = () => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
      setAutoScroll(true);
      setNewCount(0);
    }
  };

  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-cg-dark-3 to-cg-dark-2 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-lg">Live Commentary</h3>
            <span className="text-xs text-gray-400">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {sessionStatus !== "ended" && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${connected ? "bg-cg-green/10 text-cg-green" : "bg-red-500/10 text-red-400"}`}>
                {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {connected ? "Live" : "Disconnected"}
              </div>
            )}
            {sessionStatus === "ended" && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-700/50 text-gray-400 font-medium">
                Session Ended
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="max-h-[600px] overflow-y-auto relative"
      >
        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 text-lg font-medium">No commentary yet</p>
            <p className="text-gray-600 text-sm mt-1">Entries will appear here in real-time</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className={`px-5 py-4 hover:bg-gray-800/20 transition-colors ${idx === 0 ? "animate-[fadeSlideIn_0.3s_ease-out]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Over badge */}
                  {entry.overText ? (
                    <div className="w-12 h-8 rounded-lg bg-cg-green/10 border border-cg-green/20 flex items-center justify-center text-cg-green text-xs font-bold shrink-0">
                      {entry.overText}
                    </div>
                  ) : (
                    <div className="w-12 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                      <span className="text-gray-600 text-xs">•</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-relaxed">{entry.text}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-800/80 px-2 py-0.5 text-xs text-gray-300">
                        <Clock3 size={11} />
                        {new Date(entry.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      {entry.source === "voice" && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                          🎙️ Voice
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* New entries indicator */}
      {newCount > 0 && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-cg-green text-black text-sm font-bold shadow-lg shadow-cg-green/20 hover:bg-cg-green-dark transition"
        >
          <ChevronDown size={14} className="rotate-180" />
          {newCount} new {newCount === 1 ? "entry" : "entries"}
        </button>
      )}
    </div>
  );
}
