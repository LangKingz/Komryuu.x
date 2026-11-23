"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  Download,
  Flame,
  Globe,
  Layers,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

interface HeroProps {
  latestVersion?: string;
  downloadUrl?: string;
  fileSize?: string;
  releasedAt?: string;
  onOpenChangelog?: () => void;
}

const Hero: React.FC<HeroProps> = ({
  latestVersion = "1.2.0",
  downloadUrl = "/aplikasi/Komryuu.apk",
  fileSize,
  releasedAt,
  onOpenChangelog,
}) => {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* AMBIENT GLOW EFFECTS */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-600/20 via-violet-600/10 to-transparent blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/4 -z-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-[90px]" />
      <div className="pointer-events-none absolute top-1/2 right-1/4 -z-10 h-72 w-72 rounded-full bg-violet-500/10 blur-[90px]" />

      {/* SUBTLE BACKGROUND GRID PATTERN */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* VERSION & PLATFORM PILL BADGE */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300 shadow-inner backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">v{latestVersion} Active</span>
            <span className="text-indigo-400">•</span>
            <span>Unified Comic Ecosystem &amp; Cloud Sync Gateway</span>
            {releasedAt && (
              <>
                <span className="text-indigo-400">•</span>
                <span className="text-indigo-200">{new Date(releasedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
              </>
            )}
            {onOpenChangelog && (
              <>
                <span className="text-indigo-400">•</span>
                <button
                  type="button"
                  onClick={onOpenChangelog}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-200 underline decoration-indigo-400/50 underline-offset-2 hover:text-white hover:decoration-white transition"
                >
                  <Sparkles size={12} className="text-amber-300" />
                  <span>Catatan Rilis</span>
                </button>
              </>
            )}
          </div>

          {/* MAIN HEADLINE */}
          <h1 className="mt-8 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.12]">
            Ekosistem Pembaca Komik &{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-300 bg-clip-text text-transparent">
              Multi-Source Engine
            </span>{" "}
            Terpusat
          </h1>

          {/* SUBHEADLINE */}
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Satu hub terpadu untuk mengelola ekstensi komik (Shinigami, Ikiru, Komikcast),
            sinkronisasi riwayat baca lintas perangkat Android via Firestore, serta REST API v1
            berperforma tinggi.
          </p>

          {/* PRIMARY CTAS */}
          <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="group inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/25 transition-all hover:scale-[1.02] hover:shadow-indigo-500/40"
            >
              <span>Buka Admin Dashboard</span>
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </Link>

            <a
              href={downloadUrl || "/aplikasi/Komryuu.apk"}
              download="Komryuu.apk"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#1c1c28] px-7 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition-all hover:border-white/20 hover:bg-[#232332] hover:text-white"
            >
              <Download size={17} className="text-indigo-400" />
              <span>Download Android (v{latestVersion}{fileSize ? ` • ${fileSize}` : ""})</span>
            </a>
          </div>

          {/* FLOATING MOCKUP STATISTIK & PIPELINE ENGINE */}
          <div className="relative mt-16 w-full max-w-5xl">
            {/* AMBIENT CARD GLOW */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-purple-500/20 opacity-70 blur-xl" />

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c28]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              {/* TOP TERMINAL BAR */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    engine://komryuu.core.runtime
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    API Latency: 38ms
                  </span>
                  <span className="hidden sm:inline text-slate-500">|</span>
                  <span className="hidden sm:inline">Firebase DB: Synced</span>
                </div>
              </div>

              {/* THREE COLUMN PREVIEW WIDGETS */}
              <div className="mt-6 grid gap-4 text-left md:grid-cols-3">
                {/* WIDGET 1: CLOUD SYNC ENGINE */}
                <div className="rounded-xl border border-white/[0.07] bg-[#14141e]/90 p-4 transition-all hover:border-indigo-500/30">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                      <RefreshCw size={18} className="animate-spin text-indigo-400 [animation-duration:8s]" />
                    </span>
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Auto-Merge OK
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-white">Cloud Sync Pipeline</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Sinkronisasi dua arah riwayat bab dan bookmark komik dengan proteksi timestamp terbaru.
                  </p>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 text-[11px] text-slate-300 font-mono">
                    <Radio size={13} className="text-indigo-400 animate-pulse" />
                    <span>POST /api/v1/sync • 200 OK</span>
                  </div>
                </div>

                {/* WIDGET 2: MULTI-SOURCE CRAWLER */}
                <div className="rounded-xl border border-white/[0.07] bg-[#14141e]/90 p-4 transition-all hover:border-violet-500/30">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-violet-500/10 p-2 text-violet-400">
                      <Layers size={18} />
                    </span>
                    <span className="rounded-full bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                      Active Sources
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-white">Multi-Source Scraper</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Koleksi ekstensi modular: Shinigami, Ikiru, Komikcast & Comicscan dengan auto-heal link.
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.03] p-2 text-[11px] text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Globe size={13} className="text-violet-400" />
                      4+ Ekstensi Terverifikasi
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px]">100% Up</span>
                  </div>
                </div>

                {/* WIDGET 3: PRE-LOAD & DISK CACHE */}
                <div className="rounded-xl border border-white/[0.07] bg-[#14141e]/90 p-4 transition-all hover:border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                      <Cpu size={18} />
                    </span>
                    <span className="rounded-full bg-purple-400/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                      Zero Delay
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-white">Smart Image Pre-loader</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Buffer kompresi gambar berbasis CDN lokal untuk navigasi halaman tanpa buffering.
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.03] p-2 text-[11px] text-slate-300">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Flame size={13} className="text-purple-400" />
                      Cache Hit: 99.4%
                    </span>
                    <span className="text-slate-400 text-[10px]">WebP Optimized</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
