"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Send, Loader2, Pause, Play, StopCircle, Keyboard, Volume2 } from "lucide-react";

interface Entry {
  id: string;
  text: string;
  overText: string | null;
  source: string;
  createdAt: string;
}

interface ModeratorDashboardProps {
  sessionId: string;
  sessionStatus: string;
  onStatusChange: (status: string) => void;
  onEntryPosted: (entry: Entry) => void;
}

export default function ModeratorDashboard({
  sessionId,
  sessionStatus,
  onStatusChange,
  onEntryPosted,
}: ModeratorDashboardProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [overText, setOverText] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "typed">("voice");
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for waveform visualisation
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate audio level
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Use MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop visualisation
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setAudioLevel(0);

        // Stop mic
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access failed:", err);
      setError("Microphone access denied. Please enable mic permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "commentary.webm");

      const res = await fetch("/api/commentary/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transcription failed");
      }

      const data = await res.json();
      setTranscribedText(data.text || "");
    } catch (err) {
      console.error("Transcription failed:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const postEntry = async () => {
    const text = transcribedText.trim();
    if (!text) return;

    setIsPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/commentary/${sessionId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          overText: overText.trim() || null,
          source: inputMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to post entry");
      }

      const data = await res.json();
      onEntryPosted(data.entry);
      setTranscribedText("");
      setOverText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post entry");
    } finally {
      setIsPosting(false);
    }
  };

  const updateSessionStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/commentary/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        onStatusChange(newStatus);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const isLive = sessionStatus === "live";

  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header with session controls */}
      <div className="px-5 py-4 bg-gradient-to-r from-cg-dark-3 to-cg-dark-2 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLive ? "bg-red-500 animate-pulse" : sessionStatus === "paused" ? "bg-yellow-500" : "bg-gray-500"}`} />
            <h3 className="text-white font-bold text-lg">Moderator Controls</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLive ? "bg-red-500/20 text-red-400" : sessionStatus === "paused" ? "bg-yellow-500/20 text-yellow-400" : "bg-gray-500/20 text-gray-400"}`}>
              {sessionStatus.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <button
                onClick={() => updateSessionStatus("paused")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition text-sm font-medium"
              >
                <Pause size={14} /> Pause
              </button>
            )}
            {sessionStatus === "paused" && (
              <button
                onClick={() => updateSessionStatus("live")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cg-green/10 text-cg-green hover:bg-cg-green/20 transition text-sm font-medium"
              >
                <Play size={14} /> Resume
              </button>
            )}
            {sessionStatus !== "ended" && (
              <button
                onClick={() => updateSessionStatus("ended")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-medium"
              >
                <StopCircle size={14} /> End
              </button>
            )}
          </div>
        </div>
      </div>

      {sessionStatus === "ended" ? (
        <div className="px-5 py-10 text-center">
          <p className="text-gray-400 text-lg">This commentary session has ended.</p>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* Input mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInputMode("voice")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${inputMode === "voice" ? "bg-cg-green/20 text-cg-green border border-cg-green/30" : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"}`}
            >
              <Volume2 size={14} /> Voice
            </button>
            <button
              onClick={() => setInputMode("typed")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${inputMode === "typed" ? "bg-cg-green/20 text-cg-green border border-cg-green/30" : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"}`}
            >
              <Keyboard size={14} /> Type
            </button>
          </div>

          {/* Voice recording section */}
          {inputMode === "voice" && (
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Waveform visualiser ring */}
              <div className="relative">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isRecording
                      ? "bg-red-500/20 border-2 border-red-500"
                      : "bg-gray-800 border-2 border-gray-700 hover:border-cg-green/50"
                  }`}
                  style={
                    isRecording
                      ? { boxShadow: `0 0 ${20 + audioLevel * 40}px ${audioLevel * 20}px rgba(239, 68, 68, ${0.2 + audioLevel * 0.3})` }
                      : undefined
                  }
                >
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing || !isLive}
                    className="w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    {isRecording ? (
                      <MicOff size={28} className="text-red-400" />
                    ) : (
                      <Mic size={28} className="text-cg-green" />
                    )}
                  </button>
                </div>
                {/* Audio level bars */}
                {isRecording && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-400 rounded-full transition-all duration-100"
                        style={{
                          height: `${8 + audioLevel * (12 + i * 6)}px`,
                          opacity: audioLevel > i * 0.15 ? 1 : 0.3,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {isRecording
                  ? "Recording... Click to stop"
                  : isTranscribing
                  ? "Transcribing your audio..."
                  : "Click the mic to start recording"}
              </p>
              {isTranscribing && (
                <Loader2 size={20} className="text-cg-green animate-spin" />
              )}
            </div>
          )}

          {/* Over reference input */}
          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-sm font-medium whitespace-nowrap">
              Over:
            </label>
            <input
              type="text"
              placeholder="e.g. 12.3"
              value={overText}
              onChange={(e) => setOverText(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-cg-green focus:outline-none"
            />
          </div>

          {/* Transcribed / typed text area */}
          <div className="relative">
            <textarea
              placeholder={inputMode === "voice"
                ? "Transcribed text will appear here. You can edit before posting..."
                : "Type your commentary here..."}
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 resize-none focus:border-cg-green focus:outline-none transition"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Post button */}
          <button
            onClick={postEntry}
            disabled={!transcribedText.trim() || isPosting || !isLive}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cg-green text-black font-bold text-sm hover:bg-cg-green-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPosting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {isPosting ? "Posting..." : "Post Commentary"}
          </button>
        </div>
      )}
    </div>
  );
}
