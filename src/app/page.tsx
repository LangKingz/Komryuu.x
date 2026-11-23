"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Hero from "@/components/Hero";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Bell,
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
  Info,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  ThumbsUp,
  Users,
  Wrench,
  X,
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
  baseUrl?: string;
  mirrorUrls?: string[];
  status: "active" | "inactive";
  isActive: boolean;
  isVipOnly?: boolean;
  nsfw: boolean;
}

interface FeatureRequestItem {
  id: string;
  title: string;
  type: "extension" | "feature";
  description: string;
  createdByUid: string;
  createdByName: string;
  upvotes: string[];
  status: "open" | "planned" | "completed";
  adminNote?: string;
  createdAt: string;
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
    baseUrl: "https://shinigami.moe",
    mirrorUrls: ["https://shinigami01.com"],
    status: "active",
    isActive: true,
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
    baseUrl: "https://ikiru.net",
    mirrorUrls: [],
    status: "active",
    isActive: true,
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
    baseUrl: "https://komikcast.bz",
    mirrorUrls: ["https://komikcast.site"],
    status: "active",
    isActive: true,
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
    baseUrl: "https://comicscan.org",
    mirrorUrls: [],
    status: "active",
    isActive: true,
    nsfw: false,
  },
];

export default function Home() {
  const [extensions, setExtensions] = useState<ExtensionItem[]>(DEFAULT_EXTENSIONS);
  const [userCount, setUserCount] = useState<number>(128);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [appConfig, setAppConfig] = useState<{
    latestVersion: string;
    downloadUrl: string;
    changelog: string;
    maintenanceMode: boolean;
    fileSize: string;
    releasedAt: string;
    releases: { id: string; versionName: string; versionCode: number; apkUrl: string; fileSize: string; channel: string; forceUpdate: boolean; changelog: string; releasedAt: string }[];
    announcement?: {
      active: boolean;
      title: string;
      message: string;
      type: "info" | "warning" | "update";
    };
  }>({
    latestVersion: "1.2.0",
    downloadUrl: "/aplikasi/Komryuu.apk",
    changelog: "Pembaruan v1.2.0:\n• Integrasi Cloud Sync Firestore riwayat dan bookmark real-time\n• Auto-healing scraper Shinigami, Ikiru, dan Komikcast\n• Mode offline caching dengan kompresi gambar WebP\n• Remote Extension Manager & mirror fallback server.",
    maintenanceMode: false,
    fileSize: "",
    releasedAt: "",
    releases: [],
    announcement: undefined,
  });

  const [apiTab, setApiTab] = useState<"sync" | "config">("sync");

  // Community Request & Voting state
  const [requests, setRequests] = useState<FeatureRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestFilterType, setRequestFilterType] = useState<"all" | "extension" | "feature">("all");
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState({
    title: "",
    type: "extension" as "extension" | "feature",
    description: "",
    name: "",
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestToast, setRequestToast] = useState<string | null>(null);

  // Interactive APK Install Guide state
  const [activeInstallStep, setActiveInstallStep] = useState<number>(1);

  // Inisialisasi: Fetch REST API awal & Real-time listener ke Firestore
  useEffect(() => {
    // 1. Initial REST API fetch untuk config & extensions
    fetch("/api/v1/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAppConfig((prev) => ({
            ...prev,
            latestVersion: data.latestVersion || data.appUpdate?.latestAppVersion || prev.latestVersion,
            downloadUrl: data.apkUrl || data.appUpdate?.downloadUrl || prev.downloadUrl,
            changelog: data.changelog || data.appUpdate?.changelog || prev.changelog,
            maintenanceMode: Boolean(data.maintenanceMode),
            fileSize: typeof data.fileSize === "string" ? data.fileSize : prev.fileSize,
            releasedAt: typeof data.releasedAt === "string" ? data.releasedAt : prev.releasedAt,
            releases: Array.isArray(data.releases) ? data.releases : prev.releases,
            announcement: data.announcement || (data.broadcastBanner?.isActive ? {
              active: true,
              title: data.broadcastBanner.title || "Pengumuman",
              message: data.broadcastBanner.message || "",
              type: data.broadcastBanner.type || "info",
            } : undefined),
          }));
        }
      })
      .catch((err) => console.warn("Failed fetching /api/v1/config", err));

    fetch("/api/v1/extensi")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setExtensions(
            data.data.map((item: Record<string, unknown>) => {
              const isActive = item.isActive !== false && item.status !== "inactive";
              const rawMirrors = Array.isArray(item.mirrorUrls) ? item.mirrorUrls : [];
              const mirrorUrls = rawMirrors.filter((m): m is string => typeof m === "string");
              const baseUrl = typeof item.baseUrl === "string" ? item.baseUrl : (typeof item.BaseUrl === "string" ? item.BaseUrl : "");
              return {
                id: String(item.id || item.name),
                name: typeof item.name === "string" ? item.name : "Ekstensi Komik",
                description: typeof item.description === "string" ? item.description : "",
                logo: typeof item.logo === "string" ? item.logo : "",
                type: item.type === "anime" || item.type === "cinema" ? item.type : "komik",
                location: typeof item.location === "string" ? item.location : "Indonesia",
                BaseUrl: baseUrl,
                baseUrl,
                mirrorUrls,
                status: isActive ? "active" : "inactive",
                isActive,
                isVipOnly: item.isVipOnly === true,
                nsfw: item.nsfw === true,
              };
            })
          );
        }
      })
      .catch((err) => console.warn("Failed fetching /api/v1/extensi", err));

    // 2. Listen koleksi EXTENSION real-time
    const unsubExt = onSnapshot(
      collection(db, "EXTENSION"),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ExtensionItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            const isActive = data.isActive !== undefined
              ? data.isActive === true
              : data.status !== "inactive";
            const rawMirrors = Array.isArray(data.mirrorUrls) ? data.mirrorUrls : [];
            const mirrorUrls = rawMirrors.filter((m: unknown): m is string => typeof m === "string");
            const baseUrl = typeof data.baseUrl === "string" ? data.baseUrl : (typeof data.BaseUrl === "string" ? data.BaseUrl : "");

            list.push({
              id: d.id,
              name: typeof data.name === "string" ? data.name : "Ekstensi Komik",
              description: typeof data.description === "string" ? data.description : "",
              logo: typeof data.logo === "string" ? data.logo : "",
              type: data.type === "anime" || data.type === "cinema" ? data.type : "komik",
              location: typeof data.location === "string" ? data.location : "Indonesia",
              BaseUrl: baseUrl,
              baseUrl,
              mirrorUrls,
              status: isActive ? "active" : "inactive",
              isActive,
              isVipOnly: data.isVipOnly === true,
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

    // 3. Listen total USERS
    const unsubUsers = onSnapshot(
      collection(db, "USERS"),
      (snapshot) => {
        if (!snapshot.empty) {
          setUserCount(snapshot.size);
        }
      },
      () => {}
    );

    // 4. Listen App Config di SETTINGS/app_config
    const unsubConfig = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const update = (data.appUpdate && typeof data.appUpdate === "object") ? (data.appUpdate as Record<string, unknown>) : {};
          const banner = (data.broadcastBanner && typeof data.broadcastBanner === "object") ? (data.broadcastBanner as Record<string, unknown>) : {};
          const ann = (data.appAnnouncement && typeof data.appAnnouncement === "object") ? (data.appAnnouncement as Record<string, unknown>) : undefined;

          setAppConfig({
            latestVersion: typeof data.latestVersion === "string" ? data.latestVersion : (typeof update.latestAppVersion === "string" ? update.latestAppVersion : "1.2.0"),
            downloadUrl: typeof data.apkUrl === "string" ? data.apkUrl : (typeof update.downloadUrl === "string" && update.downloadUrl ? update.downloadUrl : "/aplikasi/Komryuu.apk"),
            changelog: typeof data.changelog === "string" ? data.changelog : (typeof update.changelog === "string" ? update.changelog : "Peningkatan performa dan sinkronisasi cloud."),
            maintenanceMode: data.maintenanceMode === true,
            fileSize: typeof data.fileSize === "string" ? data.fileSize : "",
            releasedAt: typeof data.releasedAt === "string" ? data.releasedAt : "",
            releases: Array.isArray(data.releases) ? (data.releases as { id: string; versionName: string; versionCode: number; apkUrl: string; fileSize: string; channel: string; forceUpdate: boolean; changelog: string; releasedAt: string }[]) : [],
            announcement: ann ? {
              active: ann.active === true,
              title: typeof ann.title === "string" ? ann.title : "Pengumuman",
              message: typeof ann.message === "string" ? ann.message : "",
              type: ann.type === "warning" || ann.type === "update" ? ann.type : "info",
            } : (banner.isActive === true ? {
              active: true,
              title: typeof banner.title === "string" ? banner.title : "Pengumuman",
              message: typeof banner.message === "string" ? banner.message : "",
              type: banner.type === "warning" || banner.type === "update" ? banner.type : "info",
            } : undefined),
          });
        }
      },
      () => {}
    );

    // 5. Listen Papan Request Komunitas di FEATURE_REQUESTS
    const unsubRequests = onSnapshot(
      query(collection(db, "FEATURE_REQUESTS"), orderBy("createdAt", "desc"), limit(40)),
      (snapshot) => {
        const list: FeatureRequestItem[] = [];
        const visitorId = typeof window !== "undefined" ? localStorage.getItem("komryuu_visitor_id") : null;
        const myVoted = new Set<string>();

        snapshot.forEach((d) => {
          const data = d.data();
          const rawUpvotes = Array.isArray(data.upvotes) ? data.upvotes : [];
          const upvotes = rawUpvotes.filter((u): u is string => typeof u === "string");

          if (visitorId && upvotes.includes(visitorId)) {
            myVoted.add(d.id);
          }

          list.push({
            id: d.id,
            title: typeof data.title === "string" ? data.title : "Tanpa Judul",
            type: data.type === "feature" ? "feature" : "extension",
            description: typeof data.description === "string" ? data.description : "",
            createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
            createdByName: typeof data.createdByName === "string" ? data.createdByName : "Pengguna Komryuu",
            upvotes,
            status: data.status === "planned" || data.status === "completed" ? data.status : "open",
            adminNote: typeof data.adminNote === "string" ? data.adminNote : "",
            createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
          });
        });

        setRequests(list);
        setVotedIds(myVoted);
        setLoadingRequests(false);
      },
      (err) => {
        console.warn("Could not load feature requests", err);
        setLoadingRequests(false);
      }
    );

    return () => {
      unsubExt();
      unsubUsers();
      unsubConfig();
      unsubRequests();
    };
  }, []);

  const activeExtensions = useMemo(() => {
    return extensions.filter((item) => item.isActive);
  }, [extensions]);

  const filteredExtensions = useMemo(() => {
    if (activeCategory === "all") return extensions;
    return extensions.filter((item) => item.type === activeCategory);
  }, [extensions, activeCategory]);

  const filteredRequests = useMemo(() => {
    let list = requests;
    if (requestFilterType !== "all") {
      list = list.filter((r) => r.type === requestFilterType);
    }
    // Sort by upvotes count desc
    return [...list].sort((a, b) => b.upvotes.length - a.upvotes.length);
  }, [requests, requestFilterType]);

  // Handle upvoting
  async function handleUpvote(reqId: string) {
    let visitorId = typeof window !== "undefined" ? localStorage.getItem("komryuu_visitor_id") : null;
    if (!visitorId && typeof window !== "undefined") {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("komryuu_visitor_id", visitorId);
    }
    if (!visitorId) return;

    try {
      const res = await fetch("/api/v1/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", id: reqId, uid: visitorId }),
      });
      const data = await res.json();
      if (data.success) {
        setVotedIds((prev) => {
          const next = new Set(prev);
          if (data.voted) next.add(reqId);
          else next.delete(reqId);
          return next;
        });

        // Optimistic update local
        setRequests((prev) =>
          prev.map((r) => {
            if (r.id !== reqId) return r;
            const hasVote = r.upvotes.includes(visitorId!);
            const newUpvotes = data.voted
              ? hasVote ? r.upvotes : [...r.upvotes, visitorId!]
              : r.upvotes.filter((u) => u !== visitorId);
            return { ...r, upvotes: newUpvotes };
          })
        );
      }
    } catch (err) {
      console.error("Upvote failed", err);
    }
  }

  // Handle submitting request from landing page
  async function handlePublicSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!newRequestForm.title.trim() || !newRequestForm.description.trim()) return;

    let visitorId = typeof window !== "undefined" ? localStorage.getItem("komryuu_visitor_id") : null;
    if (!visitorId && typeof window !== "undefined") {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("komryuu_visitor_id", visitorId);
    }

    setSubmittingRequest(true);
    try {
      const res = await fetch("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newRequestForm.title.trim(),
          type: newRequestForm.type,
          description: newRequestForm.description.trim(),
          createdByUid: visitorId || `guest-${Date.now()}`,
          createdByName: newRequestForm.name.trim() || "Pengunjung Web",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewRequestForm({ title: "", type: "extension", description: "", name: "" });
        setNewRequestModalOpen(false);
        setRequestToast("Request Anda berhasil diajukan ke papan voting komunitas!");
        setTimeout(() => setRequestToast(null), 3500);
      }
    } catch (err) {
      console.error("Submit request failed", err);
    } finally {
      setSubmittingRequest(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#14141e] text-white selection:bg-indigo-500 selection:text-white">
      {/* 0. ANNOUNCEMENT BANNER */}
      {appConfig.announcement?.active && !bannerDismissed && (
        <aside
          role="alert"
          aria-label="Pengumuman Penting"
          className={`relative border-b px-4 py-3 text-xs sm:text-sm font-medium transition ${
            appConfig.announcement.type === "warning"
              ? "border-amber-500/30 bg-amber-500/15 text-amber-200"
              : appConfig.announcement.type === "update"
              ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-200"
              : "border-sky-500/30 bg-sky-500/15 text-sky-200"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-current animate-ping" />
              <strong className="font-semibold">{appConfig.announcement.title || "Pengumuman"}:</strong>
              <span>{appConfig.announcement.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Tutup pengumuman"
            >
              <X size={16} />
            </button>
          </div>
        </aside>
      )}

      {/* 1. HERO SECTION */}
      <Hero
        latestVersion={appConfig.latestVersion}
        downloadUrl={appConfig.downloadUrl}
        fileSize={appConfig.fileSize}
        releasedAt={appConfig.releasedAt}
        onOpenChangelog={() => setChangelogOpen(true)}
      />

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
                <span>Status Sumber &amp; Ekstensi Live</span>
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Status Sumber &amp; Ekstensi Live
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Semua ekstensi di bawah ini dikelola secara dinamis melalui dashboard admin Komryuu.x
                dan langsung terhubung ke mesin pencari klien Android dengan auto-fallback mirror domain.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setChangelogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition"
              >
                <Sparkles size={13} className="text-amber-300" />
                <span>Catatan Rilis (v{appConfig.latestVersion})</span>
              </button>

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
                      activeCategory === cat.id
                        ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
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
                    {ext.isActive ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Maintenance
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      {ext.name}
                    </h3>
                    {ext.isVipOnly && (
                      <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300 border border-amber-400/20">
                        VIP
                      </span>
                    )}
                  </div>

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
                    {ext.mirrorUrls && ext.mirrorUrls.length > 0 && (
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[9px] text-indigo-300 border border-indigo-500/20">
                        +{ext.mirrorUrls.length} mirror
                      </span>
                    )}
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

      {/* 5.5 PAPAN REQUEST EKSTENSI & VOTING KOMUNITAS */}
      <section id="requests" className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-[#14141e]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                <Sparkles size={13} />
                <span>Suara Komunitas Komryuu</span>
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Papan Request Ekstensi &amp; Voting
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Bantu kami memprioritaskan scraper ekstensi komik baru dan fitur yang paling Anda butuhkan.
                Satu suara Anda menentukan rilis pembaruan berikutnya!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#1c1c28] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setRequestFilterType("all")}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    requestFilterType === "all"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Semua ({requests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFilterType("extension")}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    requestFilterType === "extension"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Ekstensi
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFilterType("feature")}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    requestFilterType === "feature"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Fitur
                </button>
              </div>

              {/* Add Request Button */}
              <button
                type="button"
                onClick={() => setNewRequestModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-600/25 hover:scale-[1.02] transition"
              >
                <Plus size={14} />
                <span>Ajukan Request</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {requestToast && (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
              {requestToast}
            </div>
          )}

          {/* Request Cards Grid */}
          <div className="mt-10">
            {loadingRequests ? (
              <div className="flex justify-center py-16">
                <Loader2 size={32} className="animate-spin text-purple-500" />
              </div>
            ) : filteredRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredRequests.map((req) => {
                  const hasVoted = votedIds.has(req.id);
                  return (
                    <article
                      key={req.id}
                      className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 transition duration-200 hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/5"
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                              req.type === "extension"
                                ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                                : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                            }`}
                          >
                            {req.type === "extension" ? "Ekstensi Komik" : "Fitur Aplikasi"}
                          </span>

                          {req.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              <CheckCircle2 size={11} /> Selesai
                            </span>
                          ) : req.status === "planned" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                              <Wrench size={11} /> Direncanakan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              <Clock size={11} /> Open Vote
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 font-semibold text-sm text-white line-clamp-1" title={req.title}>
                          {req.title}
                        </h3>

                        <p className="mt-1.5 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                          {req.description}
                        </p>

                        {req.adminNote && (
                          <div className="mt-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2 text-[11px] text-indigo-200">
                            <strong>Admin:</strong> {req.adminNote}
                          </div>
                        )}
                      </div>

                      {/* Card Footer with Upvote Button */}
                      <div className="mt-5 border-t border-white/[0.06] pt-3.5 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate max-w-[140px]">Oleh {req.createdByName}</span>

                        <button
                          type="button"
                          onClick={() => handleUpvote(req.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                            hasVoted
                              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                              : "border border-white/10 bg-[#14141e] text-slate-300 hover:border-purple-500/30 hover:text-white"
                          }`}
                        >
                          <ArrowUp size={13} className={hasVoted ? "stroke-[2.5]" : ""} />
                          <span>{req.upvotes.length}</span>
                          <span className="text-[10px]">{hasVoted ? "Upvoted" : "Vote"}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#1c1c28]/40 py-16 text-center">
                <MessageSquare size={36} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">Belum Ada Request</p>
                <p className="mt-1 text-xs text-slate-500">
                  Jadilah yang pertama mengajukan permintaan ekstensi komik baru!
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5.8 PANDUAN INSTALASI APK ANDROID INTERAKTIF */}
      <section id="install-guide" className="relative py-24 sm:py-32 border-t border-white/[0.08] bg-[#1c1c28]/50 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
              <Smartphone size={13} />
              <span>Instalasi Mudah &amp; Cepat</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Panduan Instalasi APK Android
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Pasang Komryuu.x ke perangkat Android Anda dalam 4 langkah sederhana berikut tanpa perlu root.
            </p>
          </div>

          {/* Interactive Steps Bar */}
          <div className="mt-12 grid gap-3 sm:grid-cols-4">
            {[
              { num: 1, title: "1. Unduh File APK", subtitle: "Download Komryuu.apk resmi" },
              { num: 2, title: "2. Izinkan Sumber", subtitle: "Unknown Sources di Pengaturan" },
              { num: 3, title: "3. Pasang Aplikasi", subtitle: "Buka dan ketuk tombol Install" },
              { num: 4, title: "4. Cloud Sync", subtitle: "Login Google & sinkron komik" },
            ].map((step) => (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveInstallStep(step.num)}
                className={`flex flex-col text-left p-4 rounded-2xl border transition-all ${
                  activeInstallStep === step.num
                    ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                    : "border-white/[0.08] bg-[#14141e] hover:border-white/20"
                }`}
              >
                <span className={`text-xs font-bold ${activeInstallStep === step.num ? "text-emerald-400" : "text-slate-400"}`}>
                  {step.title}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">{step.subtitle}</span>
              </button>
            ))}
          </div>

          {/* Active Step Content Showcase */}
          <div className="mt-6 rounded-3xl border border-white/[0.08] bg-[#14141e] p-6 sm:p-10 shadow-2xl">
            {activeInstallStep === 1 && (
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                    Langkah 1 dari 4
                  </span>
                  <h3 className="mt-4 text-2xl font-bold text-white">
                    Unduh Berkas APK Komryuu.x Resmi
                  </h3>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    Dapatkan berkas instalasi <strong>Komryuu.apk</strong> versi terbaru{" "}
                    <strong>v{appConfig.latestVersion}</strong> langsung dari server kami atau rilis resmi GitHub.
                    Ukuran berkas berkisar {appConfig.fileSize || "~31.5 MB"}.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a
                      href={appConfig.downloadUrl || "/aplikasi/Komryuu.apk"}
                      download="Komryuu.apk"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:scale-105 transition"
                    >
                      <Download size={15} />
                      <span>Unduh File APK Sekarang</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveInstallStep(2)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2"
                    >
                      <span>Lanjut Langkah 2</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#1c1c28] p-5 font-mono text-xs text-slate-300">
                  <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08] text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Download Manifest: v{appConfig.latestVersion}</span>
                  </div>
                  <p className="mt-3 text-slate-400">Target File: Komryuu.apk</p>
                  <p className="text-slate-400">Android SDK: Min API 24 (Android 7.0+)</p>
                  <p className="text-emerald-400 mt-2">&gt; Status: Siap diunduh tanpa registrasi Play Store.</p>
                </div>
              </div>
            )}

            {activeInstallStep === 2 && (
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                    Langkah 2 dari 4
                  </span>
                  <h3 className="mt-4 text-2xl font-bold text-white">
                    Izinkan Pemasangan dari Sumber Tidak Dikenal
                  </h3>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    Karena Komryuu.x didistribusikan langsung tanpa perantara Google Play Store, Android
                    memerlukan izin instalasi mandiri untuk browser Anda (misalnya Chrome atau File Manager).
                  </p>
                  <div className="mt-4 space-y-2 text-xs text-slate-400">
                    <p>• Masuk ke <strong>Pengaturan &gt; Keamanan &amp; Privasi</strong></p>
                    <p>• Pilih <strong>Instal Aplikasi Tidak Dikenal</strong></p>
                    <p>• Aktifkan sakelar <strong>Izinkan dari Sumber Ini</strong></p>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveInstallStep(3)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                    >
                      <span>Lanjut Langkah 3</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-xs text-amber-200">
                  <div className="flex items-center gap-2 font-semibold text-amber-300 mb-2">
                    <ShieldCheck size={16} />
                    <span>Catatan Keamanan Play Protect:</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    Jika muncul pop-up peringatan dari Google Play Protect yang bertuliskan <em>&quot;Aplikasi tidak dikenal&quot;</em>,
                    hal tersebut normal karena aplikasi ini berstatus scraper independen. Cukup ketuk <strong>Tetap Install (Install Anyway)</strong>.
                  </p>
                </div>
              </div>
            )}

            {activeInstallStep === 3 && (
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                    Langkah 3 dari 4
                  </span>
                  <h3 className="mt-4 text-2xl font-bold text-white">
                    Buka Berkas &amp; Selesaikan Pemasangan
                  </h3>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    Tarik bilah notifikasi Android Anda atau buka aplikasi <strong>Pengelola Berkas (Files)</strong> di folder <em>Downloads</em>.
                    Ketuk berkas <strong>Komryuu.apk</strong> lalu pilih <strong>Pasang (Install)</strong>.
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Proses instalasi biasanya selesai dalam waktu kurang dari 10 detik.
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveInstallStep(4)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                    >
                      <span>Lanjut Langkah 4 (Terakhir)</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#1c1c28] p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-600/30">
                    K
                  </div>
                  <h4 className="font-bold text-white text-base">Komryuu.x</h4>
                  <p className="text-xs text-slate-400 mt-1">Aplikasi siap dibuka di beranda Android Anda</p>
                </div>
              </div>
            )}

            {activeInstallStep === 4 && (
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                    Langkah 4 dari 4
                  </span>
                  <h3 className="mt-4 text-2xl font-bold text-white">
                    Login Google &amp; Aktifkan Cloud Sync
                  </h3>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    Buka aplikasi Komryuu.x, masuk dengan akun Google Anda, dan seluruh koleksi bookmark
                    serta riwayat chapter komik Anda akan tersinkronisasi dua arah secara instan ke cloud server kami.
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <a
                      href={appConfig.downloadUrl || "/aplikasi/Komryuu.apk"}
                      download="Komryuu.apk"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:scale-105 transition"
                    >
                      <Download size={15} />
                      <span>Download Komryuu.apk Sekarang</span>
                    </a>
                  </div>
                </div>
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-xs text-indigo-200">
                  <div className="flex items-center gap-2 font-semibold text-indigo-300 mb-2">
                    <Cloud size={16} />
                    <span>Sinkronisasi Otomatis Firestore:</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    Progress baca Anda tersimpan otomatis. Anda juga dapat melihat dan membagikan koleksi Anda
                    lewat fitur <strong>Pustaka Publik</strong> di website Komryuu.x kapan saja.
                  </p>
                </div>
              </div>
            )}
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
                Ukuran {appConfig.fileSize || "~31.5 MB"} (Komryuu.apk)
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

      {/* 8. CHANGELOG MODAL */}
      {changelogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="changelog-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c28] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 id="changelog-modal-title" className="text-xl font-bold text-white">
                    Catatan Rilis Komryuu.x
                  </h3>
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                    v{appConfig.latestVersion}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Build resmi rilis stabil untuk platform Android Komryuu.x
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangelogOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-6 max-h-[50vh] overflow-y-auto space-y-4 pr-1 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/[0.06] bg-[#14141e] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                  Apa yang Baru di Versi Ini:
                </h4>
                <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-slate-200">
                  {appConfig.changelog || "Pembaruan kestabilan sistem dan peningkatan kecepatan scraper ekstensi."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/[0.06] bg-[#14141e] p-3">
                  <span className="text-slate-400">Kompatibilitas:</span>
                  <p className="font-semibold text-white mt-0.5">Android 7.0+ (Nougat+)</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#14141e] p-3">
                  <span className="text-slate-400">Ukuran APK:</span>
                  <p className="font-semibold text-white mt-0.5">{appConfig.fileSize || "~31.5 MB"}</p>
                </div>
              </div>

              {/* Riwayat Versi Sebelumnya */}
              {appConfig.releases.length > 1 && (
                <details className="rounded-xl border border-white/[0.06] bg-[#14141e]">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition">
                    Lihat Riwayat Versi Sebelumnya ({appConfig.releases.length - 1} rilis lainnya)
                  </summary>
                  <div className="border-t border-white/[0.06] px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
                    {[...appConfig.releases]
                      .sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime())
                      .slice(1)
                      .map((rel) => (
                        <div key={rel.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-white">v{rel.versionName}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${rel.channel === "beta" ? "bg-amber-400/10 text-amber-300" : "bg-indigo-400/10 text-indigo-300"}`}>
                              {rel.channel}
                            </span>
                            {rel.fileSize && <span className="text-slate-500">{rel.fileSize}</span>}
                            <span className="text-slate-500">
                              {new Date(rel.releasedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          <a
                            href={rel.apkUrl}
                            download
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition"
                          >
                            <Download size={11} />
                            Download
                          </a>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={() => setChangelogOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition"
              >
                Tutup
              </button>
              <a
                href={appConfig.downloadUrl || "/aplikasi/Komryuu.apk"}
                download="Komryuu.apk"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.02] transition"
              >
                <Download size={15} />
                <span>Download APK (v{appConfig.latestVersion})</span>
              </a>
            </div>
          </div>
        </div>
      )}
      {/* 9. MODAL AJUKAN REQUEST EKSTENSI / FITUR (PUBLIK) */}
      {newRequestModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c28] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Ajukan Request Komunitas</h3>
                  <p className="text-xs text-slate-400">Usulkan sumber ekstensi komik baru atau fitur aplikasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewRequestModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePublicSubmitRequest} className="my-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tipe Permintaan *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRequestForm((prev) => ({ ...prev, type: "extension" }))}
                    className={`rounded-xl border p-3 text-left transition ${
                      newRequestForm.type === "extension"
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-white/10 bg-[#14141E] text-slate-400 hover:text-white"
                    }`}
                  >
                    <p className="font-semibold text-xs text-white">Ekstensi Komik Baru</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Situs manga/manhwa baru</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRequestForm((prev) => ({ ...prev, type: "feature" }))}
                    className={`rounded-xl border p-3 text-left transition ${
                      newRequestForm.type === "feature"
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-white/10 bg-[#14141E] text-slate-400 hover:text-white"
                    }`}
                  >
                    <p className="font-semibold text-xs text-white">Fitur Baru Aplikasi</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Kapabilitas &amp; antarmuka</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Anda (Opsional)
                </label>
                <input
                  type="text"
                  value={newRequestForm.name}
                  onChange={(e) => setNewRequestForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nama atau alias Anda"
                  className="w-full rounded-xl border border-white/10 bg-[#14141E] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-purple-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Judul Permintaan *
                </label>
                <input
                  type="text"
                  required
                  value={newRequestForm.title}
                  onChange={(e) => setNewRequestForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={
                    newRequestForm.type === "extension"
                      ? "Contoh: Ekstensi Batoto ID / Kiryuu Scans"
                      : "Contoh: Mode Offline Download Batch"
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#14141E] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-purple-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Detail / Alasan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={newRequestForm.description}
                  onChange={(e) => setNewRequestForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Sertakan domain URL atau manfaat fitur yang Anda inginkan..."
                  className="w-full rounded-xl border border-white/10 bg-[#14141E] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-purple-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  disabled={submittingRequest}
                  onClick={() => setNewRequestModalOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 hover:scale-[1.02] disabled:opacity-50 transition"
                >
                  {submittingRequest ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{submittingRequest ? "Mengirim..." : "Kirim Request"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
