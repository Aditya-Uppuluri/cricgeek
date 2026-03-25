"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PenSquare, Clock, Eye, MessageSquare, Search, Trophy, TrendingUp } from "lucide-react";
import AdSlot from "@/components/ads/AdSlot";
import WriterProfileCard from "@/components/writer/WriterProfileCard";
import { ARCHETYPE_META } from "@/lib/scoring";

interface Blog {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  tags: string;
  matchTag?: string | null;
  views: number;
  runs: number;
  createdAt: string;
  author: { id: string; name: string; avatar: string | null };
  _count: { comments: number };
  score?: { bqs: number; archetypeLabel: string } | null;
}

function getScoreColor(bqs: number): string {
  if (bqs >= 80) return "text-green-400";
  if (bqs >= 60) return "text-yellow-400";
  if (bqs >= 40) return "text-orange-400";
  return "text-red-400";
}

function getScoreBg(bqs: number): string {
  if (bqs >= 80) return "bg-green-400/10";
  if (bqs >= 60) return "bg-yellow-400/10";
  if (bqs >= 40) return "bg-orange-400/10";
  return "bg-red-400/10";
}

export default function BlogPage() {
  const searchParams = useSearchParams();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const matchId = searchParams.get("matchId") || "";

  useEffect(() => {
    fetchBlogs();
  }, [matchId]);

  const fetchBlogs = async () => {
    try {
      const params = new URLSearchParams();
      if (matchId) params.set("matchId", matchId);
      const res = await fetch(`/api/blogs${params.toString() ? `?${params.toString()}` : ""}`);
      const data = await res.json();
      setBlogs(data.blogs || []);
    } catch {
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredBlogs = blogs.filter(
    (blog) =>
      blog.title.toLowerCase().includes(search.toLowerCase()) ||
      blog.tags.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <PenSquare className="text-cg-green" />
            Community
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {matchId
              ? "Coverage linked to this match, including previews, reactions, and discussion."
              : "AI-scored cricket analysis, opinions, and discussion"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/leaderboard"
            className="bg-white/5 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-white/10 transition-all border border-gray-700 inline-flex items-center gap-2"
          >
            <Trophy size={16} className="text-yellow-400" />
            Leaderboard
          </Link>
          <Link
            href="/blog/write"
            className="bg-cg-green text-black px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-cg-green-dark transition-all inline-flex items-center gap-2"
          >
            <PenSquare size={16} />
            Write
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blogs by title or tag..."
          className="w-full bg-cg-dark-2 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:border-cg-green focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Blog List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5 animate-pulse">
                  <div className="h-5 bg-gray-800 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-800 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredBlogs.length === 0 ? (
            <div className="text-center py-12">
              <PenSquare size={48} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400">No blogs found. Be the first to write one!</p>
            </div>
          ) : (
            filteredBlogs.map((blog) => (
              <Link key={blog.id} href={`/blog/${blog.slug}`}>
                <article className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5 hover:border-cg-green/50 transition-all group">
                  <div className="flex items-start gap-4">
                    {/* BQS Score Badge */}
                    {blog.score && (
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${getScoreBg(blog.score.bqs)}`}>
                        <span className={`text-lg font-black leading-none ${getScoreColor(blog.score.bqs)}`}>
                          {blog.score.bqs}
                        </span>
                        <span className="text-[8px] text-gray-500 font-medium">BQS</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-white group-hover:text-cg-green transition-colors">
                        {blog.title}
                      </h2>
                      <p className="text-gray-400 text-sm mt-1.5 line-clamp-2">
                        {blog.excerpt}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                        <Link
                          href={`/writer/${blog.author.id}`}
                          className="text-cg-green font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {blog.author.name}
                        </Link>
                        {blog.score?.archetypeLabel && (() => {
                          const meta = ARCHETYPE_META[blog.score.archetypeLabel];
                          return meta ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.color}`}>
                              {meta.icon} {meta.label}
                            </span>
                          ) : null;
                        })()}
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(blog.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                           <Eye size={12} />
                           {blog.views}
                         </span>
                         <span className="flex items-center gap-1 text-orange-400">
                           🏏 {blog.runs ?? 0}
                         </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {blog._count.comments}
                        </span>
                      </div>
                      {blog.tags && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {blog.tags.split(",").map((tag) => (
                            <span
                              key={tag}
                              className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full"
                            >
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Top Writer */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-cg-green" />
              Top Writer
            </h3>
            <WriterProfileCard
              id="1"
              name="CricAnalyst Pro"
              avatar={null}
              archetype="analyst"
              level={8}
              xp={780}
              averageBQS={88.5}
              totalBlogs={34}
              compact
            />
          </div>

          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              {["analysis", "ipl", "test-cricket", "world-cup", "india", "t20", "bowling", "batting"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearch(tag)}
                  className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-full hover:bg-cg-green/20 hover:text-cg-green transition-all"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-2">What is BQS?</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Blog Quality Score (BQS) is our AI-powered scoring system. Each blog is analyzed for originality,
              coherence, stat accuracy, tone, and constructiveness by 6 different AI models to produce a score from 0-100.
            </p>
            <Link href="/leaderboard" className="text-cg-green text-xs font-medium mt-2 inline-block hover:underline">
              View Leaderboard →
            </Link>
          </div>

          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-2">Blog Guidelines</h3>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>• Posts must be 120–200 words</li>
              <li>• Cricket-related content only</li>
              <li>• No hate speech or personal attacks</li>
              <li>• AI scoring happens automatically</li>
              <li>• Higher BQS → higher leaderboard rank</li>
            </ul>
          </div>

          <AdSlot slot="blog-sidebar" format="rectangle" />
        </div>
      </div>
    </div>
  );
}
