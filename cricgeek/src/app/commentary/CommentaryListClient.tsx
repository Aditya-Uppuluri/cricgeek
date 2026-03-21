"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Radio, Plus, Loader2, X } from "lucide-react";
import SessionCard from "@/components/commentary/SessionCard";

interface Session {
  id: string;
  matchId: string;
  matchName: string;
  matchType: string;
  status: string;
  moderator: { id: string; name: string; avatar: string | null };
  createdAt: string;
  endedAt: string | null;
  _count: { entries: number };
}

interface Props {
  sessions: Session[];
  isModerator: boolean;
  userId?: string;
}

export default function CommentaryListClient({ sessions, isModerator, userId }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [matchName, setMatchName] = useState("");
  const [matchType, setMatchType] = useState("T20");
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");

  const liveSessions = sessions.filter((s) => s.status === "live" || s.status === "paused");
  const endedSessions = sessions.filter((s) => s.status === "ended");
  const filtered = filter === "all" ? sessions : filter === "live" ? liveSessions : endedSessions;

  const createSession = async () => {
    if (!matchId.trim() || !matchName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: matchId.trim(), matchName: matchName.trim(), matchType }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/commentary/${data.session.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Radio className="text-cg-green" />
            Live Commentary
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time voice commentary from our moderators on live matches
          </p>
        </div>
        {isModerator && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cg-green text-black font-bold text-sm hover:bg-cg-green-dark transition shrink-0"
          >
            <Plus size={16} />
            Start Commentary
          </button>
        )}
      </div>

      {/* Create session form */}
      {showCreate && (
        <div className="bg-cg-dark-2 border border-cg-green/20 rounded-2xl p-6 mb-8 animate-[fadeSlideIn_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Mic size={18} className="text-cg-green" />
              New Commentary Session
            </h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-xs font-medium mb-1.5">Match ID</label>
              <input
                type="text"
                placeholder="e.g. sm-12345"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:border-cg-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-medium mb-1.5">Match Name</label>
              <input
                type="text"
                placeholder="e.g. IND vs AUS - 3rd T20I"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:border-cg-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-medium mb-1.5">Format</label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:border-cg-green focus:outline-none"
              >
                <option value="T20">T20</option>
                <option value="T20I">T20I</option>
                <option value="ODI">ODI</option>
                <option value="Test">Test</option>
                <option value="FC">FC</option>
              </select>
            </div>
          </div>
          <button
            onClick={createSession}
            disabled={creating || !matchId.trim() || !matchName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cg-green text-black font-bold text-sm hover:bg-cg-green-dark transition disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
            {creating ? "Starting..." : "Go Live"}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(["all", "live", "ended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === f
                ? "bg-cg-green/15 text-cg-green border border-cg-green/30"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f === "live" ? `Live (${liveSessions.length})` : `Ended (${endedSessions.length})`}
          </button>
        ))}
      </div>

      {/* Sessions grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Radio size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No commentary sessions yet</p>
          <p className="text-gray-600 text-sm mt-1">
            {isModerator ? "Start a new commentary session above!" : "Check back when a match is live"}
          </p>
        </div>
      )}
    </div>
  );
}
