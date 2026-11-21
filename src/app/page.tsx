"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Hero from "@/components/Hero";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  Layers,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from "lucide-react";

interface ExtensionItem {
  id: string;
  name: string;
  description: string;
  logo: string;
  type: "komik" | "anime" | "cinema";
  location: string;
  BaseUrl: string;
  status: "active" | "inactive";
  nsfw: boolean;
}

const DEFAULT_EXTENSIONS: ExtensionItem[] = [
  {
    id: "shinigami",
    name: "Shinigami ID",
    description: "Sumber manga & manhwa terjemahan bahasa Indonesia terpopuler dengan rilis chapter super cepat.",
    logo: "",
    type: "komik",
    location: "Indonesia",
    BaseUrl: "https://shinigami.moe",
    status: "active",
    nsfw: false,
  },
  {
    id: "ikiru",
    name: "Ikiru Manga",
    description: "Katalog manga lengkap berbahasa Indonesia dengan gambar berkualitas tinggi dan server stabil.",
    logo: "",
    type: "komik",
    location: "Indonesia",
    BaseUrl: "https://ikiru.net",
    status: "active",
    nsfw: false,
  },
  {
    id: "komikcast",
    name: "Komikcast",
    description: "Pusat baca komik online terlengkap: Manhwa aksi, romansa, dan manhua kultivasi rilis harian.",
    logo: "",
    type: "komik",
    location: "Indonesia",
    BaseUrl: "https://komikcast.bz",
    status: "active",
    nsfw: false,
  },
  {
    id: "comicscan",
    name: "Comicscan",
    description: "Agregator komik berwarna internasional dengan multi-server reader dan dukungan CDN berkecepatan tinggi.",
    logo: "",
    type: "komik",
    location: "Global",
    BaseUrl: "https://comicscan.org",
    status: "active",
    nsfw: false,
  },
];

export default function Home() {
  const [extensions, setExtensions] = useState<ExtensionItem[]>(DEFAULT_EXTENSIONS);
  const [userCount, setUserCount] = useState<number>(128);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [appConfig, setAppConfig] = useState<{
    latestVersion: string;
    downloadUrl: string;
    changelog: string;
    maintenanceMode: boolean;
  }>({
    latestVersion: "1.2.0",
    downloadUrl: "/aplikasi/Komryuu.apk",
    changelog: "Pembaruan v1.2.0: Cloud Sync Firestore, perbaikan scraper Shinigami, dan mode hemat kuota.",
    maintenanceMode: false,
  });

  const [apiTab, setApiTab] = useState<"sync" | "config">("sync");

  // Real-time listener ke Firestore
  useEffect(() => {
    // 1. Listen koleksi EXTENSION
    const unsubExt = onSnapshot(
      collection(db, "EXTENSION"),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ExtensionItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              name: typeof data.name === "string" ? data.name : "Ekstensi Komik",
              description: typeof data.description === "string" ? data.description : "",
              logo: typeof data.logo === "string" ? data.logo : "",
              type: data.type === "anime" || data.type === "cinema" ? data.type : "komik",
              location: typeof data.location === "string" ? data.location : "Indonesia",
              BaseUrl: typeof data.BaseUrl === "string" ? data.BaseUrl : "",
              status: data.status === "inactive" ? "inactive" : "active",
              nsfw: data.nsfw === true,
            });
          });
          setExtensions(list);
        }
        setLoadingStats(false);
      },
      (err) => {
        console.warn("Could not load live extensions", err);
        setLoadingStats(false);
      }
    );

    // 2. Listen total USERS
    const unsubUsers = onSnapshot(
      collection(db, "USERS"),
      (snapshot) => {
        if (!snapshot.empty) {
          setUserCount(snapshot.size);
        }
      },
      () => {}
    );

    // 3. Listen App Config di SETTINGS/app_config
    const unsubConfig = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const update = (data.appUpdate && typeof data.appUpdate === "object") ? data.appUpdate : {};
          setAppConfig({
            latestVersion: typeof update.latestAppVersion === "string" ? update.latestAppVersion : "1.2.0",
            downloadUrl: typeof update.downloadUrl === "string" && update.downloadUrl ? update.downloadUrl : "/aplikasi/Komryuu.apk",
            changelog: typeof update.changelog === "string" ? update.changelog : "Peningkatan performa dan sinkronisasi cloud.",
            maintenanceMode: data.maintenanceMode === true,
          });
        }
      },
      () => {}
    );

    return () => {
      unsubExt();
      unsubUsers();
      unsubConfig();
    };
  }, []);

  const activeExtensions = useMemo(() => {
    return extensions.filter((item) => item.status === "active");
  }, [extensions]);

  const filteredExtensions = useMemo(() => {
    if (activeCategory === "all") return activeExtensions;
    return activeExtensions.filter((item) => item.type === activeCategory);
  }, [activeExtensions, activeCategory]);

  return (
    <div className="min-h-screen bg-[#14141e] text-white selection:bg-indigo-500 selection:text-white">
      {/* 1. HERO SECTION */}
      <Hero />

      {/* 2. LIVE ECOSYSTEM STATS SECTION */}
      <section id="stats" className="relative border-y border-white/[0.08] bg-[#1c1c28]/60 py-12 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Stat 1: Ekstensi Aktif */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#14141e] p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Layers size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Sumber Ekstensi Aktif</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    {loadingStats ? "..." : `${activeExtensions.length} Sumber`}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400">Live Scrapers</span>
                </div>
              </div>
            </div>

            {/* Stat 2: Total Pengguna */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#14141e] p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Pengguna Terhubung</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{userCount.toLocaleString()} Akun</span>
                  <span className="text-[11px] font-semibold text-violet-400">Firebase DB</span>
                </div>
              </div>
            </div>

            {/* Stat 3: Cloud Sync Uptime */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#14141e] p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Cloud size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Kecepatan Cloud Sync</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">&lt; 42 ms</span>
                  <span className="text-[11px] font-semibold text-emerald-400">99.9% Uptime</span>
                </div>
              </div>
            </div>

            {/* Stat 4: REST API Gateway */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#14141e] p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <Server size={24} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Status Server REST API</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">v1 Operational</span>
                  <span className="text-[11px] font-semibold text-sky-400">Secured</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SHOWCASE DAFTAR SUMBER EKSTENSI TERSEDIA */}
      <section id="extensions" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                <Globe size={13} />
                <span>Ekosistem Sumber Terverifikasi</span>
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Daftar Sumber Ekstensi Tersedia
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Semua ekstensi di bawah ini dikelola secara dinamis melalui dashboard admin Komryuu.x
                dan langsung terhubung ke mesin pencari klien Android.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#1c1c28] p-1.5 text-xs font-medium">
              {[
                { id: "all", label: "Semua Kategori" },
                { id: "komik", label: "Komik & Manhwa" },
                { id: "anime", label: "Anime" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-lg px-3.5 py-1.5 transition-all ${
                    activeCategory ===cat.id
                      ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Cards of Active Extensions */}
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredExtensions.map((ext) => (
              <div
                key={ext.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/10 border border-white/10 text-indigo-300">
                      {ext.logo ? (
                        <img src={ext.logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
                      ) : (
                        <BookOpen size={22} />
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {ext.name}
                  </h3>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                    {ext.description || "Ekstensi crawler resmi dengan scraping chapter langsung dan bypass proteksi."}
                  </p>
                </div>

                <div className="mt-5 border-t border-white/[0.06] pt-4 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-300 uppercase">
                      {ext.type}
                    </span>
                    <span className="text-[11px] text-slate-500">• {ext.location}</span>
                  </div>
                  {ext.BaseUrl && (
                    <a
                      href={ext.BaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-indigo-400 transition"
                      title="Kunjungi website asli"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SHOWCASE FITUR UTAMA (BENTO GRID MODERN) */}
      <section id="features" className="relative border-t border-white/[0.08] bg-[#14141e] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold text-violet-300">
              <Sparkles size={13} />
              <span>Kemampuan Kelas Enterprise</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Dibuat untuk Pengalaman Komik Tanpa Hambatan
            </h2>
            <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-slate-400">
              Dibangun dengan Next.js App Router, Firebase Firestore, dan arsitektur API modular
              yang mengutamakan kecepatan, sinkronisasi data instan, dan keandalan scraping.
            </p>
          </div>

          {/* BENTO GRID */}
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {/* CARD 1: CLOUD SYNC LINTAS PERANGKAT (SPAN 2 COLS) */}
            <div className="md:col-span-2 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#1c1c28] via-[#1c1c28] to-indigo-950/30 p-8 transition-all hover:border-indigo-500/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                <Cloud size={24} />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">
                Cloud Sync Lintas Perangkat Terintegrasi
              </h3>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-300">
                Ganti perangkat Android atau install ulang tanpa takut kehilangan jejak baca. Seluruh
                pustaka bookmark dan riwayat bab tersinkronisasi otomatis ke Firestore dengan
                algoritma cerdas yang membandingkan timestamp terbaru secara aman.
              </p>

              {/* Code/Flow Visual Simulation */}
              <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#14141e]/90 p-4 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between text-slate-500 border-b border-white/[0.06] pb-2 mb-2">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <CheckCircle2 size={13} /> Sync Engine: Two-way merge
                  </span>
                  <span>status: 200 OK</span>
                </div>
                <p className="text-emerald-400">&gt; Comparing incoming &amp; cloud timestamps...</p>
                <p className="text-slate-400">&gt; Synced 142 bookmark komik &amp; 850 riwayat baca.</p>
                <p className="text-indigo-300">&gt; Collection USERS/{`{uid}`}/sync_data/backup updated.</p>
              </div>
            </div>

            {/* CARD 2: MULTI-SOURCE SCRAPER ENGINE */}
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1c1c28] p-8 transition-all hover:border-violet-500/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
                <Layers size={24} />
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">
                Multi-Source Scraper Engine
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Integrasi puluhan sumber komik dan anime dengan sistem scraper modular. Tambah dan
                edit endpoint baru secara live dari dashboard admin tanpa perlu build ulang aplikasi APK.
              </p>

              <div className="mt-6 space-y-2 text-xs">
                {["Auto-heal broken image mirror", "Bypass proteksi Cloudflare & anti-bot", "Standardized JSON chapter parser"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-slate-300">
                    <Check size={14} className="text-emerald-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 3: SMART PRE-LOAD & OFFLINE READER */}
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1c1c28] p-8 transition-all hover:border-purple-500/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
                <Zap size={24} />
              </div>
              <h3 className="mt-6 text-xl font-bold text-white">
                Smart Pre-load &amp; Offline Cache
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Algoritma pre-load memuat chapter selanjutnya saat pengguna sedang membaca. Didukung
                kompresi gambar WebP yang menghemat konsumsi kuota data hingga 60%.
              </p>
              <div className="mt-6 rounded-xl bg-purple-500/10 p-3 border border-purple-500/20 text-xs text-purple-300 font-medium">
                ⚡ 0 ms latency antar transisi pergantian halaman manga.
              </div>
            </div>

            {/* CARD 4: REAL-TIME MONITORING & REST API V1 (SPAN 2 COLS) */}
            <div className="md:col-span-2 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#1c1c28] via-[#1c1c28] to-purple-950/20 p-8 transition-all hover:border-purple-500/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
                <Terminal size={24} />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-white">
                REST API v1 Berperforma Tinggi &amp; Granular RBAC
              </h3>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-300">
                Arsitektur backend tangguh yang memvalidasi header otentikasi <code className="text-sky-300">x-api-key</code>,
                membatasi rate limit request per menit, dan mendukung sistem hak akses pengguna
                bertingkat (Admin, Moderator, VIP, dan Pengguna Standar).
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg border border-white/[0.08] bg-[#14141e] px-3 py-1.5 text-slate-300">
                  Header Security: <strong className="text-sky-300">x-api-key SHA-256</strong>
                </span>
                <span className="rounded-lg border border-white/[0.08] bg-[#14141e] px-3 py-1.5 text-slate-300">
                  Rate Limit: <strong className="text-emerald-300">60 req/min</strong>
                </span>
                <span className="rounded-lg border border-white/[0.08] bg-[#14141e] px-3 py-1.5 text-slate-300">
                  Role Support: <strong className="text-violet-300">Admin, Moderator, VIP</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. API SHOWCASE & INTERACTIVE TERMINAL PREVIEW */}
      <section id="api" className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-[#1c1c28]/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300">
                <Terminal size={13} />
                <span>Dokumentasi API Terbuka</span>
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                REST API v1 untuk Klien Eksternal &amp; Aplikasi Mobile
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-300">
                Integrasikan aplikasi Android Anda secara langsung menggunakan endpoint RESTful
                yang cepat, konsisten, dan mudah diparsing menggunakan pustaka Retrofit atau Ktor.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex gap-4 rounded-xl border border-white/[0.06] bg-[#14141e] p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold">
                    POST
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">/api/v1/sync</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Upload, merge timestamp riwayat bab, dan bookmark komik ke cloud database.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 rounded-xl border border-white/[0.06] bg-[#14141e] p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold">
                    GET
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">/api/v1/config</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ambil status maintenance, banner broadcast, dan kontrol force update APK.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Window Mockup */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14141e] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-[#1c1c28]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="ml-2 font-mono text-xs text-slate-400">api-v1-preview.json</span>
                </div>

                <div className="flex gap-1 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setApiTab("sync")}
                    className={`rounded px-2.5 py-1 ${
                      apiTab === "sync" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    /sync response
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiTab("config")}
                    className={`rounded px-2.5 py-1 ${
                      apiTab === "config" ? "bg-indigo-600 text-white font-semibold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    /config response
                  </button>
                </div>
              </div>

              <div className="p-5 font-mono text-xs leading-relaxed overflow-x-auto text-slate-300">
                {apiTab === "sync" ? (
                  <pre>
{`HTTP/1.1 200 OK
Content-Type: application/json
x-api-key: [VALIDATED]

{
  "success": true,
  "syncedLibraryCount": 142,
  "syncedHistoryCount": 850,
  "lastSyncedAt": "2026-11-20T16:00:00.000Z"
}`}
                  </pre>
                ) : (
                  <pre>
{`HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "maintenanceMode": ${appConfig.maintenanceMode},
  "maintenanceMessage": "Sistem sedang beroperasi normal.",
  "broadcastBanner": {
    "isActive": false,
    "title": "Selamat datang di Komryuu.x",
    "message": "Update chapter komik terbaru tersedia.",
    "type": "info"
  },
  "appUpdate": {
    "minAppVersion": "1.0.0",
    "latestAppVersion": "${appConfig.latestVersion}",
    "forceUpdate": false,
    "downloadUrl": "${appConfig.downloadUrl}"
  }
}`}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. DOWNLOAD APP CALLOUT SECTION */}
      <section id="download" className="relative py-20 sm:py-28 overflow-hidden">
        <div className="pointer-events-none absolute -bottom-32 left-1/2 -z-10 h-96 w-[700px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-[#1c1c28] to-[#14141e] p-8 text-center shadow-2xl sm:p-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-600/30">
              <Smartphone size={32} />
            </div>

            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Download Komryuu.x untuk Android
            </h2>

            <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
              Dapatkan versi terbaru <strong>v{appConfig.latestVersion}</strong> dengan pembaca chapter
              ringan, auto-mirror image switcher, dan sinkronisasi cloud real-time.
            </p>

            {/* Download Button & Requirements */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={appConfig.downloadUrl || "/aplikasi/Komryuu.apk"}
                download="Komryuu.apk"
                className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 hover:shadow-indigo-500/50"
              >
                <Download size={20} className="transition-transform group-hover:-translate-y-0.5" />
                <span>Download APK Resmi (v{appConfig.latestVersion})</span>
              </a>

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] hover:text-white transition"
              >
                <span>Kelola di Dashboard</span>
                <ChevronRight size={16} />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" />
                Android 7.0+ (Nougat &amp; Lebih Baru)
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" />
                Bebas Iklan &amp; Open Scraper
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" />
                Ukuran ~31.5 MB (Komryuu.apk)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#101018] py-12 text-slate-400 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm">
                K
              </div>
              <div>
                <p className="font-bold text-white text-sm">Komryuu.x</p>
                <p className="text-slate-500 text-[11px]">Modern Unified Comic Ecosystem &amp; Cloud Gateway</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <a href="#features" className="hover:text-white transition">Fitur</a>
              <a href="#extensions" className="hover:text-white transition">Ekstensi</a>
              <a href="#stats" className="hover:text-white transition">Statistik</a>
              <a href="#api" className="hover:text-white transition">API Docs</a>
              <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>All Systems Operational • 2026</span>
            </div>
          </div>

          <div className="mt-8 border-t border-white/[0.06] pt-6 text-center text-slate-500 text-[11px]">
            © {new Date().getFullYear()} Komryuu.x. Hak cipta dilindungi undang-undang.
          </div>
        </div>
      </footer>
    </div>
  );
}
