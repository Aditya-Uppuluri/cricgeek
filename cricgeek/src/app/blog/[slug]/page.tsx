"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Eye, MessageSquare, Flag, Share2 } from "lucide-react";
import ScoreRing from "@/components/writer/ScoreRing";
import WriterProfileCard from "@/components/writer/WriterProfileCard";
import { use } from "react";

interface BlogData {
  id: string;
  title: string;
  content: string;
  slug: string;
  tags: string;
  views: number;
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
    constructiveness: number;
    evidencePresence: number;
    positionClarity: number;
    infoDensity: number;
    entitiesFound: number;
    statsFound: number;
    statsVerified: number;
    wordCount: number;
  } | null;
}

// Demo blog data
const DEMO_BLOG: BlogData = {
  id: "1",
  title: "Why Jasprit Bumrah is the Best Fast Bowler Right Now",
  content: `Jasprit Bumrah has firmly established himself as the most lethal fast bowler in world cricket. His unique bowling action, combined with a remarkable ability to deliver pin-point yorkers, makes him virtually unplayable on any surface.

In Test cricket, Bumrah's average of 20.83 puts him among the all-time greats. His economy rate of 4.63 in ODIs is exceptional for a strike bowler who consistently takes wickets in the powerplay and death overs.

What makes Bumrah truly special is his versatility. Whether it's the traditional red ball swinging prodigiously at Melbourne or the white ball reversing at Wankhede, he adapts his approach seamlessly. His ability to bowl critical spells — like his 6/33 against England at Trent Bridge — demonstrates a champion bowler's mentality.

However, questions remain about his workload management. While his strike rate is phenomenal, sustaining this across all three formats requires careful rotation. Nevertheless, when Bumrah is fit and firing, there is simply no better fast bowler in world cricket today.`,
  slug: "bumrah-best-fast-bowler",
  tags: "analysis,india,test-cricket,bumrah",
  views: 1250,
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
    constructiveness: 85,
    evidencePresence: 90,
    positionClarity: 78,
    infoDensity: 84,
    entitiesFound: 3,
    statsFound: 4,
    statsVerified: 3,
    wordCount: 168,
  },
};

export default function BlogSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [blog, setBlog] = useState<BlogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  useEffect(() => {
    async function fetchBlog() {
      try {
        const res = await fetch(`/api/blogs/${resolvedParams.slug}`);
        if (res.ok) {
          const data = await res.json();
          setBlog(data);
        } else {
          setBlog(DEMO_BLOG);
        }
      } catch {
        setBlog(DEMO_BLOG);
      } finally {
        setLoading(false);
      }
    }
    fetchBlog();
  }, [resolvedParams.slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-800 rounded w-1/3 mb-8" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!blog) return null;

  const scoreBreakdownItems = blog.score ? [
    { label: "Originality", value: blog.score.originalityScore, icon: "💡" },
    { label: "Coherence", value: blog.score.coherenceScore, icon: "🔗" },
    { label: "Tone", value: blog.score.toneScore, icon: "🎵" },
    { label: "Constructiveness", value: blog.score.constructiveness, icon: "🏗️" },
    { label: "Evidence", value: blog.score.evidencePresence, icon: "📊" },
    { label: "Position Clarity", value: blog.score.positionClarity, icon: "🎯" },
    { label: "Info Density", value: blog.score.infoDensity, icon: "📈" },
    { label: "Toxicity", value: 100 - blog.score.toxicityScore, icon: "🧤", invertLabel: "Clean" },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/blog" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-6">
        <ArrowLeft size={14} /> Back to Community
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <article className="lg:col-span-3">
          <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs bg-cg-green/10 text-cg-green px-2 py-1 rounded-full font-medium">
                Community Blog
              </span>
              {blog.score && (
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full capitalize">
                  {blog.score.archetypeLabel}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              {blog.title}
            </h1>

            {/* Author info */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
              <Link href={`/writer/${blog.author.id}`} className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-full bg-cg-dark-3 flex items-center justify-center text-sm font-bold text-cg-green border border-gray-700 group-hover:border-cg-green/50 transition-all">
                  {blog.author.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-cg-green transition-colors">
                    {blog.author.name}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(blog.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Eye size={10} /> {blog.views}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={10} /> {blog._count.comments}</span>
                  </div>
                </div>
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all" title="Share">
                  <Share2 size={16} />
                </button>
                <button className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Report">
                  <Flag size={16} />
                </button>
              </div>
            </div>

            {/* Stats verified badge */}
            {blog.score && blog.score.statsFound > 0 && (
              <div className="bg-cg-green/5 border border-cg-green/20 rounded-lg px-4 py-2 mb-6 flex items-center gap-2 text-sm">
                <span className="text-cg-green">✅</span>
                <span className="text-gray-300">
                  {blog.score.statsVerified}/{blog.score.statsFound} stats verified by AI
                </span>
              </div>
            )}

            {/* Content */}
            <div className="prose prose-invert max-w-none">
              {blog.content.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-gray-300 leading-relaxed mb-4 text-[15px]">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Tags */}
            {blog.tags && (
              <div className="flex flex-wrap gap-1 mt-6 pt-6 border-t border-gray-800">
                {blog.tags.split(",").map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full hover:bg-cg-green/20 hover:text-cg-green transition-all cursor-pointer"
                  >
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* Sidebar — Score Breakdown */}
        <div className="space-y-4">
          {blog.score && (
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5 sticky top-20">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                🏏 AI Quality Score
              </h3>
              <div className="flex justify-center mb-4">
                <ScoreRing score={blog.score.bqs} size={100} label="BQS" />
              </div>

              <button
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className="w-full text-xs text-cg-green text-center hover:underline mb-3"
              >
                {showScoreBreakdown ? "Hide" : "View"} breakdown
              </button>

              {showScoreBreakdown && (
                <div className="space-y-2">
                  {scoreBreakdownItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <span>{item.icon}</span>
                        {item.invertLabel || item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.value >= 80 ? "bg-green-500" :
                              item.value >= 60 ? "bg-yellow-500" :
                              item.value >= 40 ? "bg-orange-500" :
                              "bg-red-500"
                            }`}
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono w-6 text-right">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-800">
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{blog.score.wordCount}</p>
                  <p className="text-[10px] text-gray-500">Words</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{blog.score.entitiesFound}</p>
                  <p className="text-[10px] text-gray-500">Entities</p>
                </div>
              </div>
            </div>
          )}

          {/* Writer card */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">About the Author</h3>
            <WriterProfileCard
              id={blog.author.id}
              name={blog.author.name}
              avatar={blog.author.avatar}
              archetype={blog.score?.archetypeLabel || "rookie"}
              level={8}
              xp={780}
              averageBQS={88.5}
              totalBlogs={34}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}
