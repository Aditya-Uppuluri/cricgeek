"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Trophy, Award, Target, Eye, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";
import WriterDNAChart from "@/components/writer/WriterDNAChart";
import ScoreRing from "@/components/writer/ScoreRing";
import { ARCHETYPE_CONFIG, getScoreColor } from "@/components/writer/WriterProfileCard";
import { use } from "react";

interface WriterData {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
  profile: {
    averageBQS: number;
    totalBlogs: number;
    totalViews: number;
    archetype: string;
    level: number;
    xp: number;
    bestBQS: number;
    featuredCount: number;
    streak: number;
    bcs: number;
  };
  dna: { analyst: number; storyteller: number; critic: number; reporter: number; debater: number };
  badges: { badge: string; title: string; description: string; tier: string; earnedAt: string }[];
  achievements: { achievement: string; title: string; description: string; milestone: number; earnedAt: string }[];
  recentBlogs: { id: string; title: string; slug: string; views: number; createdAt: string; score: { bqs: number } | null }[];
}

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-900 border-amber-600/50",
  silver: "from-gray-300 to-gray-500 border-gray-400/50",
  gold: "from-yellow-400 to-yellow-600 border-yellow-500/50",
  platinum: "from-indigo-300 to-purple-400 border-indigo-400/50",
};

// Demo data for when API is not available
const DEMO_WRITER: WriterData = {
  id: "demo-user",
  name: "CricGeek Writer",
  avatar: null,
  bio: "Passionate cricket analyst covering all formats. Specializing in batting technique analysis and match predictions.",
  createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
  profile: { averageBQS: 74.5, totalBlogs: 12, totalViews: 3420, archetype: "analyst", level: 5, xp: 480, bestBQS: 92, featuredCount: 2, streak: 3, bcs: 82 },
  dna: { analyst: 85, storyteller: 62, critic: 55, reporter: 70, debater: 48 },
  badges: [
    { badge: "first_blood", title: "First Blood", description: "Published your first blog", tier: "bronze", earnedAt: new Date(Date.now() - 80 * 86400000).toISOString() },
    { badge: "stat_master", title: "Stat Master", description: "10+ verified stats across blogs", tier: "silver", earnedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { badge: "five_wickets", title: "Five-For", description: "5 blogs with BQS above 80", tier: "silver", earnedAt: new Date(Date.now() - 10 * 86400000).toISOString() },
  ],
  achievements: [
    { achievement: "blogs_1", title: "Opening Over", description: "Published 1 blog", milestone: 1, earnedAt: new Date(Date.now() - 80 * 86400000).toISOString() },
    { achievement: "blogs_5", title: "Building Momentum", description: "Published 5 blogs", milestone: 5, earnedAt: new Date(Date.now() - 50 * 86400000).toISOString() },
    { achievement: "blogs_10", title: "Set in the Crease", description: "Published 10 blogs", milestone: 10, earnedAt: new Date(Date.now() - 15 * 86400000).toISOString() },
    { achievement: "views_100", title: "Crowd Gathering", description: "Total 100 views", milestone: 100, earnedAt: new Date(Date.now() - 60 * 86400000).toISOString() },
    { achievement: "views_1000", title: "Stadium Roar", description: "Total 1000 views", milestone: 1000, earnedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  ],
  recentBlogs: [
    { id: "1", title: "Why Bumrah's Yorker is Literally Unplayable", slug: "bumrah-yorker-analysis", views: 890, createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), score: { bqs: 88 } },
    { id: "2", title: "IPL 2026: Mumbai Indians Auction Strategy Deep Dive", slug: "mi-auction-2026", views: 652, createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), score: { bqs: 76 } },
    { id: "3", title: "Kohli vs Root: The Definitive Test Comparison", slug: "kohli-vs-root", views: 1120, createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), score: { bqs: 92 } },
    { id: "4", title: "Spin Bowling in T20s: A Statistical Analysis", slug: "spin-t20-analysis", views: 445, createdAt: new Date(Date.now() - 20 * 86400000).toISOString(), score: { bqs: 71 } },
  ],
};

export default function WriterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [writer, setWriter] = useState<WriterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWriter() {
      try {
        const res = await fetch(`/api/writer/${resolvedParams.id}`);
        if (res.ok) {
          const data = await res.json();
          setWriter(data);
        } else {
          setWriter(DEMO_WRITER);
        }
      } catch {
        setWriter(DEMO_WRITER);
      } finally {
        setLoading(false);
      }
    }
    fetchWriter();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gray-800" />
            <div className="space-y-3 flex-1">
              <div className="h-6 bg-gray-800 rounded w-48" />
              <div className="h-4 bg-gray-800 rounded w-32" />
            </div>
          </div>
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!writer) return null;

  const config = ARCHETYPE_CONFIG[writer.profile.archetype] || ARCHETYPE_CONFIG.rookie;
  const xpProgress = writer.profile.xp % 100;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/leaderboard" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-6">
        <ArrowLeft size={14} /> Back to Leaderboard
      </Link>

      {/* Header */}
      <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cg-green/20 to-cg-dark-3 flex items-center justify-center text-3xl font-black text-cg-green border-2 border-cg-green/30 shrink-0">
            {writer.avatar ? (
              <img src={writer.avatar} alt={writer.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              writer.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-white">{writer.name}</h1>
            <p className={`text-sm ${config.color} flex items-center gap-1.5 mt-1`}>
              <span className="text-lg">{config.icon}</span>
              {config.label}
              {writer.profile.streak > 0 && (
                <span className="ml-2 text-orange-400 text-xs flex items-center gap-1">
                  🔥 {writer.profile.streak}-week streak
                </span>
              )}
            </p>
            {writer.bio && <p className="text-gray-400 text-sm mt-2">{writer.bio}</p>}
            {/* Level / XP */}
            <div className="mt-3 max-w-xs">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Level {writer.profile.level}</span>
                <span>{xpProgress}/100 XP</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cg-green to-cg-green-light rounded-full xp-fill" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </div>
          {/* BQS Score Ring */}
          <div className="shrink-0">
            <ScoreRing score={writer.profile.averageBQS} size={100} label="Avg BQS" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-gray-800">
          {[
            { icon: FileText, label: "Blogs", value: writer.profile.totalBlogs },
            { icon: Eye, label: "Total Views", value: writer.profile.totalViews.toLocaleString() },
            { icon: TrendingUp, label: "Best BQS", value: writer.profile.bestBQS },
            { icon: Target, label: "Consistency", value: `${writer.profile.bcs}%` },
            { icon: Trophy, label: "Featured", value: writer.profile.featuredCount },
            { icon: Award, label: "Badges", value: writer.badges.length },
          ].map((stat) => (
            <div key={stat.label} className="bg-cg-dark-3/50 rounded-lg p-3 text-center">
              <stat.icon size={16} className="text-cg-green mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{stat.value}</p>
              <p className="text-[10px] text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: DNA + Badges */}
        <div className="space-y-6">
          {/* Writer DNA */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              🧬 Writer DNA
            </h2>
            <div className="flex justify-center">
              <WriterDNAChart {...writer.dna} size={250} />
            </div>
          </div>

          {/* Badges */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Award size={16} className="text-cg-green" />
              Badges ({writer.badges.length})
            </h2>
            {writer.badges.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No badges earned yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {writer.badges.map((badge) => (
                  <div
                    key={badge.badge}
                    className={`relative bg-gradient-to-br ${TIER_COLORS[badge.tier] || TIER_COLORS.bronze} rounded-lg p-3 text-center border overflow-hidden`}
                    title={badge.description}
                  >
                    <div className="absolute inset-0 badge-shine" />
                    <p className="text-xl mb-1">
                      {badge.badge === "first_blood" ? "🏏" :
                       badge.badge === "stat_master" ? "📊" :
                       badge.badge === "five_wickets" ? "⭐" :
                       badge.badge === "clean_player" ? "🧤" :
                       badge.badge === "fact_checker" ? "✅" :
                       badge.badge === "century_maker" ? "💯" :
                       badge.badge === "double_century" ? "🏆" :
                       badge.badge === "all_rounder" ? "🌟" :
                       badge.badge === "consistent" ? "🔥" : "🏅"}
                    </p>
                    <p className="text-[10px] font-bold text-white/90 leading-tight">{badge.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Blogs + Achievements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Blogs */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={16} className="text-cg-green" />
              Recent Blogs
            </h2>
            <div className="space-y-3">
              {writer.recentBlogs.map((blog) => (
                <Link key={blog.id} href={`/blog/${blog.slug}`} className="block group">
                  <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-cg-dark-3/50 transition-all">
                    {/* BQS */}
                    {blog.score ? (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${getScoreColor(blog.score.bqs)} bg-cg-dark-3 shrink-0`}>
                        {blog.score.bqs}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs text-gray-600 bg-cg-dark-3 shrink-0">
                        —
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate group-hover:text-cg-green transition-colors">
                        {blog.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye size={10} /> {blog.views}
                        </span>
                        <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-cg-green" />
              Achievements ({writer.achievements.length})
            </h2>
            {writer.achievements.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No achievements unlocked yet</p>
            ) : (
              <div className="space-y-2">
                {writer.achievements.map((ach, i) => (
                  <div key={ach.achievement} className="flex items-center gap-3 p-2 rounded-lg bg-cg-dark-3/30">
                    <div className="w-8 h-8 rounded-full bg-cg-green/10 flex items-center justify-center text-cg-green font-bold text-xs shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{ach.title}</p>
                      <p className="text-[10px] text-gray-500">{ach.description}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {new Date(ach.earnedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
