"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, Bold, Italic, Strikethrough, Heading1, Heading2, Quote, List,
  ListOrdered, Minus, ImageIcon, BarChart3, UserCircle, Video, LinkIcon,
  Sun, Moon, Send, Save, Type, Sparkles, X
} from "lucide-react";
import Link from "next/link";
import { wordCount } from "@/lib/utils";

const PLACEHOLDERS = [
  "Start your innings here...",
  "Bowl your first delivery...",
  "Step up to the crease...",
  "Play your opening shot...",
  "Take guard and begin...",
];

const FONT_STYLES = [
  { id: "classic", name: "THE CLASSIC", font: "Georgia, serif", desc: "Clean serif, professional" },
  { id: "correspondent", name: "THE CORRESPONDENT", font: "'Inter', sans-serif", desc: "Modern, authoritative" },
  { id: "storyteller", name: "THE STORYTELLER", font: "'Georgia', serif", desc: "Warm, rounded, personal" },
  { id: "pundit", name: "THE PUNDIT", font: "'Arial Black', sans-serif", desc: "Bold condensed, confident" },
];

const OVERS_MESSAGES = [
  { max: 3, msg: "Just starting your innings" },
  { max: 6, msg: "Building nicely" },
  { max: 10, msg: "Solid innings developing" },
  { max: Infinity, msg: "A proper Test innings" },
];

export default function WriteBlogPage() {
  const searchParams = useSearchParams();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionUserRole, setSessionUserRole] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nightMode, setNightMode] = useState(true);
  const [fontStyle, setFontStyle] = useState("correspondent");
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [autoSaveMsg, setAutoSaveMsg] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, string>>({});
  const [generatingTags, setGeneratingTags] = useState(false);
  const [tagError, setTagError] = useState("");
  const [upgradingWriter, setUpgradingWriter] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholderIdx] = useState(() => Math.floor(Math.random() * PLACEHOLDERS.length));
  const linkedMatchId = searchParams.get("matchId")?.trim() || "";
  const linkedMatchName = searchParams.get("matchName")?.trim() || "";

  const generateTags = async () => {
    if (!content.trim() && !title.trim()) {
      setTagError("Write some content first so the AI has something to work with.");
      return;
    }
    setGeneratingTags(true);
    setTagError("");
    try {
      const res = await fetch("/api/ai/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTagError(data.error || "Tag generation failed");
        return;
      }
      // Merge with any tags the user already typed
      const existing = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...data.tags])];
      setTags(merged.join(", "));
    } catch {
      setTagError("Could not reach the AI service.");
    } finally {
      setGeneratingTags(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updated = tags.split(",").map((t) => t.trim()).filter((t) => t !== tagToRemove);
    setTags(updated.join(", "));
  };

  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

  const currentWordCount = wordCount(content);
  const overs = (currentWordCount / 50).toFixed(1);
  const oversProgress = Math.min((currentWordCount / 500) * 100, 100);
  const oversMessage = OVERS_MESSAGES.find((m) => parseFloat(overs) <= m.max)?.msg || "";
  const isValidLength = currentWordCount >= 50 && currentWordCount <= 2000;

  // Quality estimate based on word count and structure
  const qualityEstimate = Math.min(100, Math.round(
    (currentWordCount >= 50 ? 40 : (currentWordCount / 50) * 40) +
    (content.includes("\n") ? 15 : 0) +
    (title.length > 10 ? 15 : (title.length / 10) * 15) +
    (tags.length > 0 ? 10 : 0) +
    Math.min(20, (new Set(content.toLowerCase().split(/\s+/))).size / 5)
  ));

  // Stats detected (simple pattern matching)
  const statsDetected = (content.match(/\d+\.?\d*/g) || []).length;

  // Auto save
  const autoSave = useCallback(() => {
    if (content.length > 10) {
      localStorage.setItem("cricgeek-draft", JSON.stringify({ title, content, tags, time: Date.now() }));
      setAutoSaveMsg("🏏 Your innings is saved");
      setTimeout(() => setAutoSaveMsg(""), 2000);
    }
  }, [title, content, tags]);

  useEffect(() => {
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [autoSave]);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        setSessionUserId(data?.user?.id || null);
        setSessionUserRole(data?.user?.role || null);
      } catch {
        setSessionUserId(null);
        setSessionUserRole(null);
      }
    }

    void loadSession();
  }, []);

  // Load draft
  useEffect(() => {
    try {
      const draft = localStorage.getItem("cricgeek-draft");
      if (draft) {
        const parsed = JSON.parse(draft);
        if (Date.now() - parsed.time < 86400000) {
          setTitle(parsed.title || "");
          setContent(parsed.content || "");
          setTags(parsed.tags || "");
        }
      }
    } catch { /* ignore */ }
  }, []);

  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const activateWriterProfile = async () => {
    setUpgradingWriter(true);
    setError("");

    try {
      const res = await fetch("/api/writer/profile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not activate your writer profile.");
        return;
      }

      setSessionUserRole(data.user?.role || "writer");
      window.dispatchEvent(new Event("auth-change"));
    } catch {
      setError("Could not activate your writer profile.");
    } finally {
      setUpgradingWriter(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidLength) {
      setError(`Blog must be at least 50 words. Current: ${currentWordCount} words.`);
      return;
    }

    if (!sessionUserId) {
      setError("__auth__"); // Special signal to show sign-in banner
      return;
    }

    setLoading(true);

    // Simulate pipeline steps
    const steps = [
      { key: "originality", label: "Originality check", delay: 400 },
      { key: "toxicity", label: "Toxicity check", delay: 600 },
      { key: "stats", label: "Stat verification", delay: 1200 },
      { key: "quality", label: "Quality scoring", delay: 1800 },
    ];
    for (const step of steps) {
      setTimeout(() => {
        setPipelineStatus((prev) => ({ ...prev, [step.key]: "done" }));
      }, step.delay);
    }

    try {
      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, tags, matchId: linkedMatchId || null }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Server error (${res.status}). Please try again.`);
        return;
      }

      // Only show success AFTER confirmed by server
      setSubmitted(true);

      // Fire-and-forget AI scoring
      try {
        fetch("/api/scoring/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blogId: data.blog.id }),
        });
      } catch { /* scoring is non-blocking */ }

      localStorage.removeItem("cricgeek-draft");
    } catch (err) {
      console.error("Submit error:", err);
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentFont = FONT_STYLES.find((f) => f.id === fontStyle) || FONT_STYLES[1];

  // Submission success screen
  if (submitted && !error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl p-8 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-gradient-to-b from-cg-green/5 to-transparent" />
            <div className="relative">
              {/* Cricket ball */}
              <div className="text-6xl mb-4 ball-bounce inline-block">🏏</div>
              <h2 className="text-2xl font-black text-white mb-2">
                BALL DELIVERED!
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Your blog is now in the CricGeek review crease.
              </p>

              <div className="bg-cg-dark-3/50 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs text-gray-500 mb-3">Our AI umpires are analysing:</p>
                <div className="space-y-2">
                  {[
                    { key: "originality", label: "Originality check" },
                    { key: "toxicity", label: "Toxicity check" },
                    { key: "stats", label: "Stat verification" },
                    { key: "quality", label: "Quality scoring" },
                  ].map((step) => (
                    <div key={step.key} className="flex items-center gap-2 text-sm">
                      {pipelineStatus[step.key] === "done" ? (
                        <span className="text-cg-green check-reveal">✅</span>
                      ) : (
                        <span className="animate-spin text-gray-500">⏳</span>
                      )}
                      <span className={pipelineStatus[step.key] === "done" ? "text-white" : "text-gray-500"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-6">
                Estimated time: 2–3 minutes
              </p>

              <div className="flex flex-col gap-2">
                <Link href="/blog" className="bg-cg-green text-black py-2.5 rounded-lg font-bold text-sm hover:bg-cg-green-dark transition-all block">
                  📰 Read Today&apos;s Blogs
                </Link>
                <button onClick={() => { setSubmitted(false); setTitle(""); setContent(""); setTags(""); setPipelineStatus({}); }} className="bg-white/5 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-white/10 transition-all border border-gray-700">
                  ✍️ Start Another Blog
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${nightMode ? "bg-cg-dark" : "bg-[#FAFAF5]"}`}>
      {/* Top bar */}
      <div className={`border-b ${nightMode ? "border-gray-800 bg-cg-dark-2" : "border-gray-200 bg-white"} px-4 py-2 flex items-center justify-between`}>
        <Link href="/blog" className={`text-sm flex items-center gap-1 ${nightMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-black"}`}>
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="flex items-center gap-2">
          {autoSaveMsg && (
            <span className="text-xs text-cg-green animate-pulse">{autoSaveMsg}</span>
          )}
          <button onClick={autoSave} className={`p-2 rounded-lg transition-all ${nightMode ? "text-gray-400 hover:text-white hover:bg-gray-800" : "text-gray-500 hover:text-black hover:bg-gray-100"}`} title="Save draft">
            <Save size={16} />
          </button>
          <button onClick={() => setShowFontPicker(!showFontPicker)} className={`p-2 rounded-lg transition-all ${nightMode ? "text-gray-400 hover:text-white hover:bg-gray-800" : "text-gray-500 hover:text-black hover:bg-gray-100"}`} title="Font style">
            <Type size={16} />
          </button>
          <button onClick={() => setNightMode(!nightMode)} className={`p-2 rounded-lg transition-all ${nightMode ? "text-gray-400 hover:text-white hover:bg-gray-800" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}>
            {nightMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {linkedMatchId && (
        <div className="px-4 pt-4">
          <div className="mx-auto max-w-5xl rounded-xl border border-cg-green/20 bg-cg-green/5 px-4 py-3 text-sm text-cg-green">
            Writing for match coverage:
            {" "}
            <span className="font-semibold text-white">{linkedMatchName || linkedMatchId}</span>
          </div>
        </div>
      )}

      {/* Font picker dropdown */}
      {showFontPicker && (
        <div className={`absolute right-4 top-24 z-50 ${nightMode ? "bg-cg-dark-2 border-gray-800" : "bg-white border-gray-200"} border rounded-xl p-3 shadow-xl w-64`}>
          {FONT_STYLES.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFontStyle(f.id); setShowFontPicker(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                fontStyle === f.id
                  ? "bg-cg-green/10 text-cg-green"
                  : nightMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
              }`}
              style={{ fontFamily: f.font }}
            >
              <span className="font-bold text-xs">{f.name}</span>
              <br />
              <span className={`text-[10px] ${nightMode ? "text-gray-500" : "text-gray-400"}`}>{f.desc}</span>
            </button>
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error === "__auth__" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-400">
                <span>🔐</span>
                <span>You need to be signed in to publish a blog.</span>
              </div>
              <Link
                href="/auth/login?redirect=/blog/write"
                className="bg-cg-green text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-cg-green-dark transition-all whitespace-nowrap"
              >
                Sign In
              </Link>
            </div>
          )}
          {sessionUserId && sessionUserRole === "user" && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-blue-200">Writer access is required to publish.</p>
                <p className="text-blue-100/80">
                  Normal users can react, save, and follow writers. Activate your writer profile to start publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={activateWriterProfile}
                disabled={upgradingWriter}
                className="rounded-lg bg-cg-green px-4 py-2 text-xs font-bold text-black hover:bg-cg-green-dark disabled:opacity-60"
              >
                {upgradingWriter ? "Activating..." : "Become a Writer"}
              </button>
            </div>
          )}
          {error && error !== "__auth__" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full bg-transparent text-2xl sm:text-3xl font-bold focus:outline-none placeholder-gray-600 ${nightMode ? "text-white" : "text-gray-900"}`}
            placeholder="Your headline..."
            required
            maxLength={100}
            style={{ fontFamily: currentFont.font }}
          />

          {/* Formatting Toolbar */}
          <div className={`flex flex-wrap items-center gap-1 p-2 rounded-xl border ${nightMode ? "bg-cg-dark-2 border-gray-800" : "bg-gray-50 border-gray-200"}`}>
            <span className={`text-[10px] font-bold px-2 ${nightMode ? "text-gray-600" : "text-gray-400"}`}>BATTING ORDER</span>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => insertFormatting("**", "**")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Bold"><Bold size={14} /></button>
              <button type="button" onClick={() => insertFormatting("*", "*")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Italic"><Italic size={14} /></button>
              <button type="button" onClick={() => insertFormatting("~~", "~~")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Strikethrough"><Strikethrough size={14} /></button>
            </div>
            <div className={`w-px h-5 mx-1 ${nightMode ? "bg-gray-700" : "bg-gray-300"}`} />
            <span className={`text-[10px] font-bold px-2 ${nightMode ? "text-gray-600" : "text-gray-400"}`}>FIELD</span>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => insertFormatting("# ")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Heading 1"><Heading1 size={14} /></button>
              <button type="button" onClick={() => insertFormatting("## ")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Heading 2"><Heading2 size={14} /></button>
              <button type="button" onClick={() => insertFormatting("> ")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Quote"><Quote size={14} /></button>
              <button type="button" onClick={() => insertFormatting("- ")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Bullet list"><List size={14} /></button>
              <button type="button" onClick={() => insertFormatting("1. ")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Numbered list"><ListOrdered size={14} /></button>
              <button type="button" onClick={() => insertFormatting("\n---\n")} className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Divider"><Minus size={14} /></button>
            </div>
            <div className={`w-px h-5 mx-1 ${nightMode ? "bg-gray-700" : "bg-gray-300"}`} />
            <span className={`text-[10px] font-bold px-2 ${nightMode ? "text-gray-600" : "text-gray-400"}`}>EXTRAS</span>
            <div className="flex gap-0.5">
              <button type="button" className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Insert image"><ImageIcon size={14} /></button>
              <button type="button" className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Insert stat card"><BarChart3 size={14} /></button>
              <button type="button" className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Insert player card"><UserCircle size={14} /></button>
              <button type="button" className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Insert video"><Video size={14} /></button>
              <button type="button" className={`p-1.5 rounded ${nightMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-200 text-gray-600"}`} title="Insert link"><LinkIcon size={14} /></button>
            </div>
          </div>

          {/* Content */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`w-full bg-transparent text-base leading-relaxed focus:outline-none min-h-[350px] resize-y ${nightMode ? "text-gray-200 placeholder-gray-700" : "text-gray-800 placeholder-gray-400"}`}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            required
            style={{ fontFamily: currentFont.font }}
          />

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-sm font-medium ${nightMode ? "text-gray-300" : "text-gray-600"}`}>
                Tags
              </label>
              <button
                type="button"
                onClick={generateTags}
                disabled={generatingTags}
                className="flex items-center gap-1.5 text-xs font-medium text-cg-green hover:text-cg-green-dark disabled:opacity-50 transition-all"
                title="Generate tags with local Llama AI"
              >
                {generatingTags ? (
                  <><span className="w-3 h-3 border border-cg-green/50 border-t-cg-green rounded-full animate-spin" />Generating...</>
                ) : (
                  <><Sparkles size={12} />AI Generate</>  
                )}
              </button>
            </div>

            {/* Tag chips */}
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-cg-green/10 text-cg-green border border-cg-green/20 text-xs px-2 py-0.5 rounded-full"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-cg-green/60 hover:text-cg-green ml-0.5 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              type="text"
              value={tags}
              onChange={(e) => { setTags(e.target.value); setTagError(""); }}
              className={`w-full bg-transparent border rounded-lg px-4 py-2.5 text-sm focus:border-cg-green focus:outline-none ${
                nightMode ? "border-gray-800 text-white" : "border-gray-300 text-gray-800"
              }`}
              placeholder="e.g., analysis, ipl, india — or click AI Generate ✨"
            />

            {tagError && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                ⚠️ {tagError}
                {tagError.includes("ollama") || tagError.includes("connect") ? (
                  <span className="text-gray-500 ml-1">(Run <code className="text-gray-400">ollama serve</code> in a terminal)</span>
                ) : null}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || (sessionUserId !== null && sessionUserRole === "user")}
            className="w-full bg-cg-green text-black py-3 rounded-xl font-bold text-sm hover:bg-cg-green-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {loading ? "Delivering..." : sessionUserRole === "user" ? "Activate Writer Profile to Publish" : "Deliver the Ball"}
          </button>
          {!isValidLength && currentWordCount > 0 && (
            <p className={`text-center text-xs ${currentWordCount < 50 ? "text-amber-400" : "text-red-400"}`}>
              {currentWordCount < 50
                ? `${50 - currentWordCount} more words needed (minimum 50)`
                : `${currentWordCount - 2000} words over the 2000-word limit`}
            </p>
          )}
        </form>
      </div>

      {/* Writing Metrics Bar — fixed bottom */}
      <div className={`fixed bottom-0 left-0 right-0 border-t ${nightMode ? "bg-cg-dark-2/95 border-gray-800" : "bg-white/95 border-gray-200"} backdrop-blur-sm z-40`}>
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <span className={nightMode ? "text-gray-400" : "text-gray-600"}>
              📝 <span className="font-medium">{currentWordCount}</span> words
            </span>
            <span className={nightMode ? "text-gray-400" : "text-gray-600"}>
              Overs: <span className="font-bold text-cg-green">{overs}</span>
            </span>
            <span className={`hidden sm:inline ${nightMode ? "text-gray-500" : "text-gray-400"}`}>
              {oversMessage}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className={nightMode ? "text-gray-400" : "text-gray-600"}>
              📊 Stats: <span className="font-medium">{statsDetected}</span>
            </span>
            <span className={nightMode ? "text-gray-400" : "text-gray-600"}>
              🎯 Quality: <span className={`font-bold ${qualityEstimate >= 70 ? "text-cg-green" : qualityEstimate >= 40 ? "text-yellow-400" : "text-red-400"}`}>{qualityEstimate}/100</span>
            </span>
          </div>
        </div>
        {/* Over counter bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-cg-green to-cg-green-light transition-all duration-300"
            style={{ width: `${oversProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
