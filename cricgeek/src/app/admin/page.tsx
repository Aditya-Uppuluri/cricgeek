"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, FileText, Trophy, Star, Check, X, AlertTriangle, Plus,
  Brain, Activity, BarChart3, Zap, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import ScoreRing from "@/components/writer/ScoreRing";

type AdminTab = "blogs" | "contests" | "featured" | "scoring";

interface AdminBlog {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  author: { name: string; email: string };
  _count: { comments: number; reports: number };
}

// Demo scoring data
const DEMO_SCORED_BLOGS = [
  { id: "1", title: "Why Bumrah's Yorker is Literally Unplayable", author: "CricAnalyst Pro", bqs: 88, toxicity: 3, archetype: "analyst", status: "completed" },
  { id: "2", title: "IPL 2026 Auction Analysis", author: "TheCricStoryteller", bqs: 76, toxicity: 5, archetype: "storyteller", status: "completed" },
  { id: "3", title: "Kohli vs Root: The Definitive Comparison", author: "CricAnalyst Pro", bqs: 92, toxicity: 2, archetype: "debater", status: "completed" },
  { id: "4", title: "Spin Bowling in T20s: A Statistical Analysis", author: "SpinWizard", bqs: 72, toxicity: 8, archetype: "reporter", status: "completed" },
  { id: "5", title: "Why Indian Cricket is Going Downhill", author: "AngryFan99", bqs: 34, toxicity: 62, archetype: "critic", status: "flagged" },
];

const PIPELINE_MODELS = [
  { name: "RoBERTa Sentiment", host: "HuggingFace Spaces", status: "online", latency: "320ms" },
  { name: "Toxic-BERT", host: "Oracle Cloud VM 2", status: "online", latency: "180ms" },
  { name: "MiniLM Embeddings", host: "Oracle Cloud VM 2", status: "online", latency: "150ms" },
  { name: "BART-MNLI", host: "HuggingFace Spaces", status: "online", latency: "450ms" },
  { name: "BERT-NER", host: "Oracle Cloud VM 2", status: "online", latency: "200ms" },
  { name: "Rule Engine", host: "Oracle Cloud VM 1", status: "online", latency: "12ms" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("blogs");
  const [blogs, setBlogs] = useState<AdminBlog[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<"loading" | "admin" | "user" | "guest">("loading");

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        if (!session?.user) {
          setAuthState("guest");
          return;
        }

        setAuthState(session.user.role === "admin" ? "admin" : "user");
      } catch {
        setAuthState("guest");
      }
    }

    void loadSession();
  }, []);

  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blogs?status=${statusFilter}`);
      const data = await res.json();
      setBlogs(data.blogs || []);
    } catch {
      setBlogs([
        { id: "1", title: "Why India Will Win the World Cup 2026", status: "pending", createdAt: new Date().toISOString(), author: { name: "CricketFan99", email: "fan@example.com" }, _count: { comments: 0, reports: 0 } },
        { id: "2", title: "IPL Auction Strategy Deep Dive", status: "pending", createdAt: new Date().toISOString(), author: { name: "AnalystPro", email: "analyst@example.com" }, _count: { comments: 0, reports: 1 } },
      ]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (authState !== "admin") {
      return;
    }
    void fetchBlogs();
  }, [statusFilter, authState, fetchBlogs]);

  const updateBlogStatus = async (blogId: string, status: string) => {
    try {
      await fetch("/api/admin/blogs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId, status }),
      });
      setBlogs((prev) => prev.map((b) => (b.id === blogId ? { ...b, status } : b)));
    } catch {
      console.error("Failed to update blog");
    }
  };

  const tabs = [
    { id: "blogs" as const, label: "Blog Moderation", icon: FileText },
    { id: "scoring" as const, label: "AI Scoring", icon: Brain },
    { id: "contests" as const, label: "Contests", icon: Trophy },
    { id: "featured" as const, label: "Featured Content", icon: Star },
  ];

  if (authState === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-white font-semibold">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (authState === "guest") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-cg-dark-2 border border-gray-800 rounded-2xl p-8 text-center">
          <Shield className="text-cg-green mx-auto mb-4" size={32} />
          <h1 className="text-2xl font-black text-white mb-2">Admin Sign-In Required</h1>
          <p className="text-gray-400 mb-6">Only administrators can access this dashboard.</p>
          <a
            href="/auth/login?next=/admin"
            className="inline-flex items-center justify-center rounded-xl bg-cg-green px-5 py-3 text-sm font-bold text-black hover:bg-cg-green-dark transition-all"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (authState === "user") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-cg-dark-2 border border-red-500/20 rounded-2xl p-8 text-center">
          <Shield className="text-red-400 mx-auto mb-4" size={32} />
          <h1 className="text-2xl font-black text-white mb-2">Access Restricted</h1>
          <p className="text-gray-400">This view is only available to admin accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-black text-white flex items-center gap-3 mb-2">
        <Shield className="text-cg-green" />
        Admin Panel
      </h1>
      <p className="text-gray-400 text-sm mb-8">
        Manage blogs, AI scoring pipeline, contests, and featured content
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-cg-dark-2 border border-gray-800 rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
              activeTab === tab.id
                ? "bg-cg-green text-black"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Blog Moderation */}
      {activeTab === "blogs" && (
        <div>
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {["pending", "approved", "rejected", "featured", "all"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                  statusFilter === s ? "bg-cg-green text-black" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-800 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-gray-800 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {blogs.map((blog) => (
                <div key={blog.id} className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{blog.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>by {blog.author.name}</span>
                        <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-medium capitalize",
                          blog.status === "approved" ? "bg-green-500/10 text-green-400" :
                          blog.status === "rejected" ? "bg-red-500/10 text-red-400" :
                          blog.status === "featured" ? "bg-amber-500/10 text-amber-400" :
                          "bg-yellow-500/10 text-yellow-400"
                        )}>
                          {blog.status}
                        </span>
                        {blog._count.reports > 0 && (
                          <span className="flex items-center gap-1 text-red-400">
                            <AlertTriangle size={12} /> {blog._count.reports} reports
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {blog.status !== "approved" && (
                        <button onClick={() => updateBlogStatus(blog.id, "approved")} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all" title="Approve">
                          <Check size={16} />
                        </button>
                      )}
                      {blog.status !== "rejected" && (
                        <button onClick={() => updateBlogStatus(blog.id, "rejected")} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all" title="Reject">
                          <X size={16} />
                        </button>
                      )}
                      {blog.status === "approved" && (
                        <button onClick={() => updateBlogStatus(blog.id, "featured")} className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all" title="Feature">
                          <Star size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {blogs.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">No blogs in this category</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Scoring Dashboard */}
      {activeTab === "scoring" && (
        <div className="space-y-6">
          {/* Pipeline Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-cg-green" />
                <span className="text-xs text-gray-500">Pipeline Status</span>
              </div>
              <p className="text-2xl font-black text-cg-green">Online</p>
              <p className="text-[10px] text-gray-500 mt-1">All 6 models running</p>
            </div>
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-blue-400" />
                <span className="text-xs text-gray-500">Avg BQS</span>
              </div>
              <p className="text-2xl font-black text-white">72.4</p>
              <p className="text-[10px] text-cg-green mt-1">↑ 3.2 from last week</p>
            </div>
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-yellow-400" />
                <span className="text-xs text-gray-500">Blogs Scored</span>
              </div>
              <p className="text-2xl font-black text-white">47</p>
              <p className="text-[10px] text-gray-500 mt-1">This week</p>
            </div>
            <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-xs text-gray-500">Flagged</span>
              </div>
              <p className="text-2xl font-black text-red-400">1</p>
              <p className="text-[10px] text-gray-500 mt-1">High toxicity detected</p>
            </div>
          </div>

          {/* Model Health */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Brain size={16} className="text-cg-green" />
              Model Health
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PIPELINE_MODELS.map((model) => (
                <div key={model.name} className="flex items-center gap-3 bg-cg-dark-3/50 rounded-lg p-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    model.status === "online" ? "bg-cg-green pulse-green" : "bg-red-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{model.name}</p>
                    <p className="text-[10px] text-gray-500">{model.host}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{model.latency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Scored Blogs */}
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-cg-green" />
              Recent Scores
            </h3>
            <div className="space-y-2">
              {DEMO_SCORED_BLOGS.map((blog) => (
                <div
                  key={blog.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg",
                    blog.status === "flagged" ? "bg-red-500/5 border border-red-500/20" : "bg-cg-dark-3/30"
                  )}
                >
                  <ScoreRing score={blog.bqs} size={44} strokeWidth={3} showLabel={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{blog.title}</p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
                      <span>{blog.author}</span>
                      <span className="capitalize bg-gray-800 px-1.5 py-0.5 rounded">{blog.archetype}</span>
                      {blog.toxicity > 50 && (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertTriangle size={10} /> Toxicity: {blog.toxicity}%
                        </span>
                      )}
                    </div>
                  </div>
                  {blog.status === "flagged" && (
                    <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-1 rounded-full">
                      FLAGGED
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contests */}
      {activeTab === "contests" && (
        <div>
          <button className="bg-cg-green text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-cg-green-dark transition-all flex items-center gap-2 mb-6">
            <Plus size={16} />
            Create Contest
          </button>
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-8 text-center">
            <Trophy size={48} className="text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400">
              Contest management interface. Create prediction contests, fantasy leagues, and community challenges.
            </p>
          </div>
        </div>
      )}

      {/* Featured Content */}
      {activeTab === "featured" && (
        <div>
          <button className="bg-cg-green text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-cg-green-dark transition-all flex items-center gap-2 mb-6">
            <Plus size={16} />
            Add Featured Content
          </button>
          <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-8 text-center">
            <Star size={48} className="text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400">
              Select and manage featured matches, blogs, and analysis that appear on the homepage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
