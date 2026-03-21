"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Eye,
  MessageSquare,
  Flag,
  Share2,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import ScoreRing from "@/components/writer/ScoreRing";
import WriterProfileCard from "@/components/writer/WriterProfileCard";
import { ARCHETYPE_META } from "@/lib/scoring";
import { use } from "react";

interface BlogData {
  id: string;
  title: string;
  content: string;
  slug: string;
  tags: string;
  views: number;
  runs: number;
  createdAt: string;
  author: { id: string; name: string; avatar: string | null };
  _count: { comments: number };
  score: {
    bqs: number;
    toneScore: number;
    toxicityScore: number;
    originalityScore: number;
    coherenceScore: number;
    archetypeLabel: string;
    archetypeConfidence: number;
    constructiveness: number;
    evidencePresence: number;
    positionClarity: number;
    infoDensity: number;
    argumentLogic: number;
    entitiesFound: number;
    statsFound: number;
    statsVerified: number;
    statAccuracy: number;
    wordCount: number;
    processingTimeMs: number;
  } | null;
  authorProfile?: {
    averageBQS: number;
    totalBlogs: number;
    archetype: string;
    level: number;
    xp: number;
    bcs: number;
    writerTitle: string;
    statAccuracy: number;
  };
}

const DEMO_BLOG: BlogData = {
  id: "1",
  title: "Why Jasprit Bumrah is the Best Fast Bowler Right Now",
  content: `Jasprit Bumrah has firmly established himself as the most lethal fast bowler in world cricket. His unique bowling action, combined with a remarkable ability to deliver pin-point yorkers, makes him virtually unplayable on any surface.\n\nIn Test cricket, Bumrah's average of 20.83 puts him among the all-time greats. His economy rate of 4.63 in ODIs is exceptional for a strike bowler who consistently takes wickets in the powerplay and death overs.\n\nWhat makes Bumrah truly special is his versatility. Whether it's the traditional red ball swinging prodigiously at Melbourne or the white ball reversing at Wankhede, he adapts his approach seamlessly. His ability to bowl critical spells — like his 6/33 against England at Trent Bridge — demonstrates a champion bowler's mentality.\n\nHowever, questions remain about his workload management. While his strike rate is phenomenal, sustaining this across all three formats requires careful rotation. Nevertheless, when Bumrah is fit and firing, there is simply no better fast bowler in world cricket today.`,
  slug: "bumrah-best-fast-bowler",
  tags: "analysis,india,test-cricket,bumrah",
  views: 1250,
  runs: 47,
  createdAt: new Date().toISOString(),
  author: { id: "1", name: "CricAnalyst Pro", avatar: null },
  _count: { comments: 24 },
  score: {
    bqs: 88,
    toneScore: 82,
    toxicityScore: 3,
    originalityScore: 79,
    coherenceScore: 91,
    archetypeLabel: "analyst",
    archetypeConfidence: 0.82,
    constructiveness: 85,
    evidencePresence: 90,
    positionClarity: 78,
    infoDensity: 84,
    argumentLogic: 70,
    entitiesFound: 3,
    statsFound: 4,
    statsVerified: 3,
    statAccuracy: 75,
    wordCount: 168,
    processingTimeMs: 1240,
  },
  authorProfile: {
    averageBQS: 87.5,
    totalBlogs: 34,
    archetype: "analyst",
    level: 8,
    xp: 780,
    bcs: 82,
    writerTitle: "THE ANALYST",
    statAccuracy: 81,
  },
};

function getBQSColor(bqs: number): string {
  if (bqs >= 80) return "text-green-400";
  if (bqs >= 60) return "text-yellow-400";
  if (bqs >= 40) return "text-orange-400";
  return "text-red-400";
}

function getBarColor(val: number): string {
  if (val >= 80) return "bg-green-500";
  if (val >= 60) return "bg-yellow-500";
  if (val >= 40) return "bg-orange-500";
  return "bg-red-500";
}

// BCS tier display
function getBadgeTier(bcs: number): { label: string; icon: string; color: string } {
  if (bcs >= 93) return { label: "CricGeek Verified", icon: "✒️", color: "text-indigo-300" };
  if (bcs >= 81) return { label: "Diamond Expert",    icon: "💎", color: "text-cyan-300" };
  if (bcs >= 66) return { label: "Gold Correspondent",icon: "🥇", color: "text-yellow-400" };
  if (bcs >= 41) return { label: "Silver Analyst",    icon: "🥈", color: "text-gray-300" };
  return { label: "Bronze Scribe", icon: "🥉", color: "text-amber-600" };
}

export default function BlogSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const [blog, setBlog] = useState<BlogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [runs, setRuns] = useState(0);
  const [runsGiven, setRunsGiven] = useState(false);
  const [milestone, setMilestone] = useState<string | null>(null);
  const viewCounted = useRef(false);
  const startTime = useRef(Date.now());
  const scrolledEnough = useRef(false);

  const countView = useCallback(async (slug: string) => {
    if (viewCounted.current) return;
    const timeOnPage = (Date.now() - startTime.current) / 1000;
    if (!scrolledEnough.current || timeOnPage < 10) return;
    viewCounted.current = true;
    try {
      const res = await fetch(`/api/blogs/${slug}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrolled: true, timeOnPage }),
      });
      const data = await res.json();
      if (data.milestone) {
        const msgs: Record<number, string> = {
          100:   "🎉 Century! 100 readers",
          1000:  "🏏 Your blog hit 1,000 views!",
          10000: "💎 VIRAL — 10,000 readers!",
        };
        setMilestone(msgs[data.milestone] ?? null);
        setTimeout(() => setMilestone(null), 5000);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function fetchBlog() {
      try {
        const res = await fetch(`/api/blogs/${resolvedParams.slug}`);
        if (res.ok) {
          const data = await res.json();
          setBlog(data);
          setRuns(data.runs ?? 0);
        } else {
          setBlog(DEMO_BLOG);
          setRuns(DEMO_BLOG.runs);
        }
      } catch {
        setBlog(DEMO_BLOG);
        setRuns(DEMO_BLOG.runs);
      } finally {
        setLoading(false);
      }
    }
    fetchBlog();
  }, [resolvedParams.slug]);

  // Smart view counting: track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollPct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrollPct >= 0.20) {
        scrolledEnough.current = true;
        if (blog) countView(resolvedParams.slug);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [blog, resolvedParams.slug, countView]);

  // Also try counting view after 10s even without scroll
  useEffect(() => {
    if (!blog) return;
    const timer = setTimeout(() => {
      if (scrolledEnough.current) countView(resolvedParams.slug);
    }, 11000);
    return () => clearTimeout(timer);
  }, [blog, resolvedParams.slug, countView]);

  const handleGiveRun = async () => {
    if (runsGiven || !blog) return;
    setRunsGiven(true);
    setRuns((r) => r + 1);
    try {
      await fetch(`/api/blogs/${blog.slug}/runs`, { method: "POST" });
    } catch {
      setRuns((r) => r - 1);
      setRunsGiven(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-800 rounded w-1/3 mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!blog) return null;

  const archMeta = blog.score
    ? (ARCHETYPE_META[blog.score.archetypeLabel] ?? ARCHETYPE_META.analyst)
    : ARCHETYPE_META.fan;

  const badgeTier = blog.authorProfile
    ? getBadgeTier(blog.authorProfile.bcs)
    : { label: "Bronze Scribe", icon: "🥉", color: "text-amber-600" };

  const scoreBreakdownItems = blog.score
    ? [
        { label: "Originality",     value: blog.score.originalityScore,  icon: "💡" },
        { label: "Coherence",       value: blog.score.coherenceScore,     icon: "🔗" },
        { label: "Constructive",    value: blog.score.constructiveness,   icon: "🏗️" },
        { label: "Evidence",        value: blog.score.evidencePresence,   icon: "📊" },
        { label: "Argument Logic",  value: blog.score.argumentLogic ?? 0, icon: "⚖️" },
        { label: "Info Density",    value: blog.score.infoDensity,        icon: "📈" },
        { label: "Stat Accuracy",   value: blog.score.statAccuracy,       icon: "✅" },
        { label: "Toxicity Free",   value: 100 - blog.score.toxicityScore,icon: "🧤" },
      ]
    : [];

  const runBats = Math.min(5, Math.round((runs / Math.max(blog.views, 1)) * 50));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Milestone Toast */}
      {milestone && (
        <div className="fixed top-4 right-4 z-50 bg-cg-green text-black px-5 py-3 rounded-xl font-bold shadow-xl animate-bounce">
          {milestone}
        </div>
      )}

      <Link
        href="/blog"
        className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-6"
      >
        <ArrowLeft size={14} /> Back to Community
      </Link>

      {/* ── Section 1: Stadium Header ─────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden mb-6"
        style={{
          background: "linear-gradient(135deg, #052e16 0%, #0f172a 50%, #1e1b4b 100%)",
        }}
      >
        {/* Green pitch overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, #22c55e 0px, #22c55e 1px, transparent 1px, transparent 40px)" }} />
        <div className="relative px-6 sm:px-10 py-8 sm:py-10">
          {/* Archetype badge */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${archMeta.bgColor} ${archMeta.color} border border-current/30`}
            >
              {archMeta.icon} {archMeta.label}
            </span>
            {blog.score && (
              <span className="text-xs text-gray-400">
                {Math.round(blog.score.archetypeConfidence * 100)}% match
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-5">
            {blog.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
            <Link
              href={`/writer/${blog.author.id}`}
              className="font-semibold text-white hover:text-cg-green transition-colors"
            >
              {blog.author.name}
            </Link>
            {blog.authorProfile && (
              <span className={`text-xs font-bold ${badgeTier.color}`}>
                {badgeTier.icon} {badgeTier.label}
              </span>
            )}
            <span className="flex items-center gap-1 text-gray-400">
              <Clock size={12} /> {new Date(blog.createdAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <Eye size={12} /> {blog.views.toLocaleString()} views
            </span>
            <span className="flex items-center gap-1 text-orange-400 font-medium">
              🏏 {runs.toLocaleString()} runs
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <MessageSquare size={12} /> {blog._count.comments}
            </span>
          </div>
        </div>

        {/* BQS ring overlay (top right) */}
        {blog.score && (
          <div className="absolute top-6 right-6 sm:top-8 sm:right-10">
            <ScoreRing score={blog.score.bqs} size={80} label="BQS" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Main Content Column ─────────────────────────────────── */}
        <article className="lg:col-span-3 space-y-4">
          {/* ── Section 2: Writer Identity Strip ──────────────────── */}
          {blog.authorProfile && (
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl px-5 py-4 flex flex-wrap items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cg-green/30 to-cg-dark-3 flex items-center justify-center text-cg-green font-black shrink-0 border border-cg-green/30">
                {blog.author.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/writer/${blog.author.id}`}
                  className="text-sm font-bold text-white hover:text-cg-green transition-colors"
                >
                  {blog.author.name}
                </Link>
                {blog.authorProfile.writerTitle && (
                  <p className="text-[10px] text-gray-500 font-mono tracking-widest">
                    {blog.authorProfile.writerTitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                <div className="text-center">
                  <p className={`font-bold text-sm ${getBQSColor(blog.authorProfile.averageBQS)}`}>
                    {blog.authorProfile.averageBQS.toFixed(1)}
                  </p>
                  <p className="text-[10px]">Avg BQS</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-white">{blog.authorProfile.totalBlogs}</p>
                  <p className="text-[10px]">Blogs</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-white">
                    {Math.round(blog.authorProfile.statAccuracy ?? 0)}%
                  </p>
                  <p className="text-[10px]">Stat Acc.</p>
                </div>
                <Link
                  href={`/writer/${blog.author.id}`}
                  className="text-cg-green text-xs font-medium hover:underline ml-2"
                >
                  View Profile →
                </Link>
              </div>
            </div>
          )}

          {/* ── Section 3: BQS Strip (collapsible) ────────────────── */}
          {blog.score && (
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-cg-dark-3/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 size={14} className="text-cg-green" />
                  <span className="text-xs font-bold text-white">
                    Blog Quality Score
                  </span>
                  <span className={`text-sm font-black ${getBQSColor(blog.score.bqs)}`}>
                    {blog.score.bqs}/100
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${archMeta.bgColor} ${archMeta.color}`}
                  >
                    {archMeta.icon} {archMeta.label} Archetype
                  </span>
                </div>
                {showScoreBreakdown ? (
                  <ChevronUp size={14} className="text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </button>

              {showScoreBreakdown && (
                <div className="px-5 pb-4 grid grid-cols-2 gap-x-6 gap-y-2">
                  {scoreBreakdownItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-sm w-4 shrink-0">{item.icon}</span>
                      <span className="text-[11px] text-gray-400 flex-1 truncate">{item.label}</span>
                      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full transition-all ${getBarColor(item.value)}`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 w-6 text-right shrink-0">
                        {Math.round(item.value)}
                      </span>
                    </div>
                  ))}
                  <div className="col-span-2 mt-2 pt-2 border-t border-gray-800 flex items-center gap-4 text-[10px] text-gray-500">
                    <span>⚡ Processed in {blog.score.processingTimeMs}ms</span>
                    <span>📝 {blog.score.wordCount} words</span>
                    <span>
                      ✅ {blog.score.statsVerified}/{blog.score.statsFound} stats verified
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Section 5: Blog Content ────────────────────────────── */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl p-6 sm:p-8">
            {/* Stats verified banner */}
            {blog.score && blog.score.statsFound > 0 && (
              <div className="bg-cg-green/5 border border-cg-green/20 rounded-lg px-4 py-2 mb-6 flex items-center gap-2 text-sm">
                <span className="text-cg-green">✅</span>
                <span className="text-gray-300">
                  {blog.score.statsVerified}/{blog.score.statsFound} stats verified by AI
                </span>
              </div>
            )}

            <div className="space-y-5">
              {blog.content.split("\n\n").map((paragraph, i) => (
                <p
                  key={i}
                  className="text-gray-300 leading-[1.9] text-[15.5px] tracking-[0.01em]"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Tags */}
            {blog.tags && (
              <div className="flex flex-wrap gap-1.5 mt-8 pt-6 border-t border-gray-800">
                {blog.tags.split(",").map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-800 text-gray-400 text-[11px] px-3 py-1 rounded-full hover:bg-cg-green/20 hover:text-cg-green transition-all cursor-pointer"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-800">
              <button
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                title="Share"
              >
                <Share2 size={16} />
              </button>
              <button
                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                title="Report"
              >
                <Flag size={16} />
              </button>
            </div>
          </div>

          {/* ── Section 11: End of Blog Card ─────────────────────── */}
          <div
            className="rounded-2xl p-6 sm:p-8 text-center"
            style={{
              background: "linear-gradient(135deg, #052e16 0%, #0f172a 100%)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <p className="text-xl font-black text-white mb-1">🏏 INNINGS COMPLETE!</p>
            {blog.score && (
              <p className="text-sm text-gray-400 mb-4">
                You just read a{" "}
                <span className={`font-bold ${badgeTier.color}`}>{badgeTier.label}</span> analysis
              </p>
            )}

            {/* Runs (5 bat emojis) */}
            <p className="text-xs text-gray-400 mb-3">Give your runs:</p>
            <div className="flex items-center justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={handleGiveRun}
                  disabled={runsGiven}
                  title={runsGiven ? "Already given" : "Give a run!"}
                  className={`text-2xl transition-all hover:scale-125 active:scale-95 ${
                    runsGiven && n <= runBats + 1 ? "opacity-100" : "opacity-40"
                  } ${runsGiven ? "cursor-default" : "cursor-pointer hover:opacity-100"}`}
                >
                  🏏
                </button>
              ))}
            </div>

            {/* Blog stats */}
            <div className="grid grid-cols-4 gap-3 mb-6 max-w-sm mx-auto">
              {[
                { label: "Runs", value: `🏏 ${runs.toLocaleString()}` },
                { label: "Views", value: `👁️ ${blog.views.toLocaleString()}` },
                { label: "Comments", value: `💬 ${blog._count.comments}` },
                {
                  label: "Stats",
                  value: `⚽ ${blog.score?.statsVerified ?? 0}`,
                },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 rounded-lg py-2 px-1">
                  <p className="text-sm font-bold text-white">{s.value}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Link
                href={`/blog/${blog.slug}#comments`}
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all flex items-center gap-2"
              >
                💬 Join Discussion
              </Link>
              <Link
                href="/blog/write"
                className="bg-cg-green hover:bg-cg-green-dark text-black text-sm font-bold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2"
              >
                🏏 Write Your Take
              </Link>
            </div>
          </div>
        </article>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* BQS compact sidebar */}
          {blog.score && (
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4 sticky top-20">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                🏏 AI Quality Score
              </h3>
              <div className="flex justify-center mb-4">
                <ScoreRing score={blog.score.bqs} size={90} label="BQS" />
              </div>
              <div className="space-y-2">
                {scoreBreakdownItems.slice(0, 4).map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-xs w-3 shrink-0">{item.icon}</span>
                    <span className="text-[10px] text-gray-500 flex-1 truncate">{item.label}</span>
                    <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getBarColor(item.value)}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 w-5 text-right">
                      {Math.round(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Author card */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-white mb-3">About the Author</h3>
            <WriterProfileCard
              id={blog.author.id}
              name={blog.author.name}
              avatar={blog.author.avatar}
              archetype={blog.score?.archetypeLabel ?? "fan"}
              level={blog.authorProfile?.level ?? 1}
              xp={blog.authorProfile?.xp ?? 0}
              averageBQS={blog.authorProfile?.averageBQS ?? 0}
              totalBlogs={blog.authorProfile?.totalBlogs ?? 0}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}
