"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bug,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  HardDrive,
  History,
  Inbox,
  Info,
  Layers,
  Loader2,
  LogOut,
  MessageSquare,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  User as UserIcon,
  Wrench,
  Zap,
} from "lucide-react";

interface ComicBookmark {
  comicId: string;
  title: string;
  coverUrl: string;
  sourceName: string;
  status: string;
  updatedAt: string | number;
}

interface ReadingHistory {
  comicId: string;
  title: string;
  coverUrl: string;
  sourceName: string;
  lastChapterNumber: string | number;
  lastChapterTitle: string;
  lastPage: number;
  updatedAt: string | number;
}

interface UserReport {
  id: string;
  type: string;
  title: string;
  description: string;
  extensionName?: string;
  comicId?: string;
  chapterTitle?: string;
  targetUrl?: string;
  status: "pending" | "in_progress" | "resolved";
  adminNote?: string;
  createdAt: string;
  deviceInfo?: Record<string, unknown>;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const d = toDate.call(value);
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function formatSafeDate(value: unknown): string {
  const d = parseDate(value);
  if (!d) return "Belum pernah";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(value: unknown): string {
  const date = parseDate(value);
  if (!date) return "Belum ada";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} minggu lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeComicBookmark(item: unknown): ComicBookmark | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;

  const title = String(
    rec.title || rec.judul || rec.comicTitle || rec.name || rec.nama || rec.judulKomik || ""
  ).trim();

  let comicId = String(
    rec.comicId || rec.comic_id || rec.id || rec.link || rec.url || rec.comicUrl || rec.komikId || rec.mangaId || rec.slug || ""
  ).trim();

  if (!comicId && title && title !== "Tanpa Judul") {
    comicId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  if (!comicId && !title) return null;

  const coverUrl = String(
    rec.coverUrl || rec.cover_url || rec.cover || rec.gambar || rec.thumbnail || rec.thumb || rec.image || rec.img || rec.foto || ""
  ).trim();

  const sourceName = String(
    rec.sourceName || rec.source_name || rec.source || rec.sumber || rec.extensionName || rec.ext || "Komik"
  ).trim();

  const status = String(rec.status || rec.state || "").trim();

  const updatedAt =
    rec.updatedAt !== undefined
      ? (rec.updatedAt as string | number)
      : rec.updated_at !== undefined
        ? (rec.updated_at as string | number)
        : Date.now();

  return {
    comicId: comicId || `comic-${Date.now()}`,
    title: title || "Tanpa Judul",
    coverUrl,
    sourceName: sourceName || "Sumber Komik",
    status,
    updatedAt,
  };
}

function normalizeReadingHistory(item: unknown): ReadingHistory | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;

  const title = String(
    rec.title || rec.judul || rec.comicTitle || rec.name || rec.nama || rec.judulKomik || ""
  ).trim();

  let comicId = String(
    rec.comicId || rec.comic_id || rec.id || rec.link || rec.url || rec.comicUrl || rec.komikId || rec.mangaId || rec.slug || ""
  ).trim();

  if (!comicId && title && title !== "Tanpa Judul") {
    comicId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  if (!comicId && !title) return null;

  const coverUrl = String(
    rec.coverUrl || rec.cover_url || rec.cover || rec.gambar || rec.thumbnail || rec.thumb || rec.image || rec.img || rec.foto || ""
  ).trim();

  const sourceName = String(
    rec.sourceName || rec.source_name || rec.source || rec.sumber || rec.extensionName || rec.ext || "Komik"
  ).trim();

  const lastChapterNumber =
    rec.lastChapterNumber !== undefined
      ? (rec.lastChapterNumber as string | number)
      : rec.last_chapter_number !== undefined
        ? (rec.last_chapter_number as string | number)
        : rec.chapter !== undefined
          ? (rec.chapter as string | number)
          : rec.lastChapter !== undefined
            ? (rec.lastChapter as string | number)
            : "-";

  const lastChapterTitle = String(
    rec.lastChapterTitle || rec.last_chapter_title || rec.chapterTitle || rec.chapter_title || ""
  ).trim();

  const lastPage = typeof rec.lastPage === "number" ? rec.lastPage : typeof rec.page === "number" ? rec.page : 0;

  const updatedAt =
    rec.updatedAt !== undefined
      ? (rec.updatedAt as string | number)
      : rec.updated_at !== undefined
        ? (rec.updated_at as string | number)
        : Date.now();

  return {
    comicId: comicId || `comic-${Date.now()}`,
    title: title || "Tanpa Judul",
    coverUrl,
    sourceName: sourceName || "Sumber Komik",
    lastChapterNumber,
    lastChapterTitle,
    lastPage,
    updatedAt,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [userData, setUserData] = useState<{
    role: string;
    vipExpiresAt?: unknown;
    permissions: {
      canAccessAdminPanel: boolean;
      bypassRateLimit: boolean;
      canAccessNsfw: boolean;
    };
    isBanned: boolean;
    banReason: string;
    deviceInfo?: Record<string, unknown>;
    createdAt?: unknown;
    lastLoginAt?: unknown;
  } | null>(null);

  const [syncData, setSyncData] = useState<{
    library: ComicBookmark[];
    history: ReadingHistory[];
    lastSyncedAt: string | null;
  }>({
    library: [],
    history: [],
    lastSyncedAt: null,
  });

  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"library" | "history" | "reports">("library");

  // Local search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Toast notification
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        document.cookie = "komryuu_session=; path=/; max-age=0;";
        document.cookie = "komryuu_role=; path=/; max-age=0;";
        router.push("/login");
        return;
      }

      setCurrentUser(user);

      // 1. Listen dokumen profil user di USERS/{uid}
      const userRef = doc(db, "USERS", user.uid);
      unsubSnapshot = onSnapshot(userRef, async (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const role = typeof d.role === "string" ? d.role.toLowerCase() : "user";
          const perms = (d.permissions && typeof d.permissions === "object")
            ? (d.permissions as Record<string, unknown>)
            : {};

          setUserData({
            role,
            vipExpiresAt: d.vipExpiresAt,
            permissions: {
              canAccessAdminPanel: perms.canAccessAdminPanel === true,
              bypassRateLimit: perms.bypassRateLimit === true,
              canAccessNsfw: perms.canAccessNsfw === true,
            },
            isBanned: d.isBanned === true,
            banReason: typeof d.banReason === "string" ? d.banReason : "",
            deviceInfo: typeof d.deviceInfo === "object" && d.deviceInfo !== null ? (d.deviceInfo as Record<string, unknown>) : undefined,
            createdAt: d.createdAt,
            lastLoginAt: d.lastLoginAt,
          });

          // 2. Baca data library & history
          let libItems: ComicBookmark[] = [];
          let histItems: ReadingHistory[] = [];
          let lastSyncedAtStr: string | null = null;

          // Cek data di subcollection backup USERS/{uid}/sync_data/backup
          try {
            const backupSnap = await getDoc(doc(db, "USERS", user.uid, "sync_data", "backup"));
            if (backupSnap.exists()) {
              const bData = backupSnap.data();
              const rawLib = bData.library || bData.pustaka || bData.bookmarks || [];
              const rawHist = bData.history || bData.riwayat || [];
              if (Array.isArray(rawLib)) {
                libItems = rawLib.map(normalizeComicBookmark).filter((i): i is ComicBookmark => i !== null);
              }
              if (Array.isArray(rawHist)) {
                histItems = rawHist.map(normalizeReadingHistory).filter((i): i is ReadingHistory => i !== null);
              }
              lastSyncedAtStr = typeof bData.lastSyncedAt === "string" ? bData.lastSyncedAt : null;
            }
          } catch (err) {
            console.warn("Could not read backup subcollection:", err);
          }

          // Jika subcollection kosong, fallback ke dokumen induk
          if (libItems.length === 0 && Array.isArray(d.library)) {
            libItems = d.library.map(normalizeComicBookmark).filter((i): i is ComicBookmark => i !== null);
          }
          if (histItems.length === 0 && Array.isArray(d.history)) {
            histItems = d.history.map(normalizeReadingHistory).filter((i): i is ReadingHistory => i !== null);
          }
          if (!lastSyncedAtStr && d.lastSyncedAt) {
            const parsed = parseDate(d.lastSyncedAt);
            if (parsed) lastSyncedAtStr = parsed.toISOString();
          }

          setSyncData({
            library: libItems,
            history: histItems,
            lastSyncedAt: lastSyncedAtStr,
          });
        }
        setLoading(false);
      });

      // 3. Ambil riwayat laporan pengguna dari koleksi REPORTS
      try {
        setReportsLoading(true);
        const reportsRef = collection(db, "REPORTS");
        const reportsQuery = query(reportsRef, orderBy("createdAt", "desc"));
        const reportsSnap = await getDocs(reportsQuery);

        const userReports: UserReport[] = [];
        reportsSnap.forEach((docItem) => {
          const repData = docItem.data();
          if (repData.uid === user.uid || (user.email && repData.userEmail === user.email)) {
            userReports.push({
              id: docItem.id,
              type: repData.type || "feedback",
              title: repData.title || "Laporan Masalah",
              description: repData.description || "",
              extensionName: repData.extensionName || "",
              comicId: repData.comicId || "",
              chapterTitle: repData.chapterTitle || "",
              targetUrl: repData.targetUrl || repData.url || repData.link || "",
              status: repData.status || "pending",
              adminNote: repData.adminNote || "",
              createdAt: repData.createdAt || new Date().toISOString(),
              deviceInfo: repData.deviceInfo,
            });
          }
        });
        setReports(userReports);
      } catch (repErr) {
        console.error("Error loading user reports:", repErr);
      } finally {
        setReportsLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "komryuu_session=; path=/; max-age=0;";
    document.cookie = "komryuu_role=; path=/; max-age=0;";
    router.push("/login");
  }

  // Export JSON Backup
  function exportUserBackup() {
    if (!currentUser) return;
    try {
      const backupPayload = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: currentUser.uid,
          name: currentUser.displayName || "User",
          email: currentUser.email,
          role: userData?.role || "user",
        },
        summary: {
          libraryCount: syncData.library.length,
          historyCount: syncData.history.length,
          lastSyncedAt: syncData.lastSyncedAt,
        },
        library: syncData.library,
        history: syncData.history,
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const safeName = (currentUser.displayName || currentUser.email || "komryuu-backup")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      anchor.download = `komryuu-sync-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast({ kind: "success", message: "File backup JSON berhasil diunduh." });
    } catch (err) {
      console.error("Failed to export backup", err);
      setToast({ kind: "error", message: "Gagal membuat file backup." });
    }
  }

  // Filtered lists based on local search query
  const filteredLibrary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return syncData.library;
    return syncData.library.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.sourceName.toLowerCase().includes(q) ||
        item.comicId.toLowerCase().includes(q)
    );
  }, [syncData.library, searchQuery]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return syncData.history;
    return syncData.history.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.sourceName.toLowerCase().includes(q) ||
        String(item.lastChapterNumber).toLowerCase().includes(q)
    );
  }, [syncData.history, searchQuery]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.extensionName && item.extensionName.toLowerCase().includes(q))
    );
  }, [reports, searchQuery]);

  // VIP Expiry Calculator
  const vipStatus = useMemo(() => {
    if (userData?.role !== "vip") return null;
    if (!userData.vipExpiresAt) {
      return {
        isPermanent: true,
        text: "Masa Aktif: Permanen",
        detail: "Akses VIP seumur hidup tanpa batas kedaluwarsa.",
        isExpired: false,
      };
    }
    const d = parseDate(userData.vipExpiresAt);
    if (!d) {
      return {
        isPermanent: true,
        text: "Masa Aktif: Permanen",
        detail: "Akses VIP seumur hidup.",
        isExpired: false,
      };
    }
    const diffMs = d.getTime() - Date.now();
    if (diffMs <= 0) {
      return {
        isPermanent: false,
        text: "Masa Aktif VIP Telah Berakhir",
        detail: "Masa aktif habis. Hubungi admin untuk perpanjangan akses.",
        isExpired: true,
      };
    }
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      isPermanent: false,
      text: `Sisa Masa Aktif: ${daysLeft} Hari Lagi`,
      detail: `Berlaku hingga ${d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`,
      isExpired: false,
      daysLeft,
    };
  }, [userData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-400">Memuat profil Komryuu...</p>
        </div>
      </div>
    );
  }

  const role = userData?.role || "user";
  const isVip = role === "vip";
  const isAdmin = role === "admin";
  const isModerator = role === "moderator";

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#14141E]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-600/30 transition-transform group-hover:scale-105">
              <Zap size={18} />
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-lg text-white">Komryuu</span>
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-lg font-extrabold text-transparent">
                .x
              </span>
            </div>
            <span className="hidden sm:inline-flex rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              Portal Akun
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {(isAdmin || isModerator) && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
              >
                <Shield size={14} />
                <span className="hidden sm:inline">Admin Dashboard</span>
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={14} />
              <span>Beranda</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/20 transition"
            >
              <LogOut size={14} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        {toast && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${toast.kind === "error"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              }`}
          >
            {toast.message}
          </div>
        )}

        {/* 1. KARTU IDENTITAS USER & STATUS VIP */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#14141E] p-6 sm:p-8 shadow-2xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* User Avatar & Info */}
            <div className="flex items-center gap-4 sm:gap-5">
              {currentUser?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUser.photoURL}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-2 border-indigo-500/30 object-cover shadow-xl"
                />
              ) : (
                <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl">
                  <UserIcon size={40} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white truncate max-w-[260px] sm:max-w-md">
                    {currentUser?.displayName || "Pengguna Komryuu"}
                  </h1>

                  {/* Badge Role Sesuai Spesifikasi: MEMBER, VIP ACCESS, MODERATOR, ADMIN */}
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-0.5 text-xs font-bold text-rose-300">
                      <Shield size={12} /> ADMIN
                    </span>
                  ) : isModerator ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-0.5 text-xs font-bold text-amber-300">
                      <Shield size={12} /> MODERATOR
                    </span>
                  ) : isVip ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/20 px-3 py-0.5 text-xs font-bold text-purple-300 shadow-sm shadow-purple-500/20">
                      <Crown size={13} className="text-amber-400" /> VIP ACCESS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-xs font-semibold text-sky-300">
                      <CheckCircle2 size={12} /> MEMBER
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-300">{currentUser?.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-[11px] text-slate-500 truncate max-w-[220px] sm:max-w-xs">
                    UID: {currentUser?.uid}
                  </span>
                  <span>•</span>
                  <span>
                    Sinkron:{" "}
                    <strong className="text-sky-300">
                      {syncData.lastSyncedAt ? formatSafeDate(syncData.lastSyncedAt) : "Belum Pernah"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Export Backup */}
            <div className="flex flex-wrap md:flex-col items-start md:items-end gap-3">
              <button
                type="button"
                onClick={exportUserBackup}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
              >
                <Download size={15} />
                <span>Export Backup (.json)</span>
              </button>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 font-medium">
                <Smartphone size={13} />
                <span>Terkoneksi Aplikasi Android</span>
              </span>
            </div>
          </div>

          {/* Banner Khusus VIP Status jika role === "vip" */}
          {isVip && vipStatus && (
            <div
              className={`mt-6 rounded-2xl border p-4 ${vipStatus.isExpired
                ? "border-rose-500/30 bg-rose-950/20 text-rose-200"
                : "border-purple-500/30 bg-gradient-to-r from-purple-950/30 to-indigo-950/30 text-purple-200"
                }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-purple-500/20 p-2 text-purple-300">
                    <Crown size={22} />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      {vipStatus.text}
                      {vipStatus.isPermanent && <Sparkles size={14} className="text-amber-400" />}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-300">{vipStatus.detail}</p>
                  </div>
                </div>
                {!vipStatus.isExpired && (
                  <span className="hidden sm:inline-flex rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300 border border-purple-500/30">
                    Premium Active
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="mt-6 border-t border-white/[0.08] pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="rounded-2xl border border-white/[0.06] bg-[#1c1c28] p-3.5">
              <p className="text-slate-400">Bookmark Tersinkron</p>
              <p className="mt-1 text-xl font-bold text-white">{syncData.library.length} Komik</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#1c1c28] p-3.5">
              <p className="text-slate-400">Riwayat Baca</p>
              <p className="mt-1 text-xl font-bold text-white">{syncData.history.length} Judul</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#1c1c28] p-3.5">
              <p className="text-slate-400">Laporan Terkirim</p>
              <p className="mt-1 text-xl font-bold text-amber-300">{reports.length} Tiket</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#1c1c28] p-3.5">
              <p className="text-slate-400">Rate Limit API</p>
              <p className="mt-1 text-xl font-bold text-indigo-300">
                {userData?.permissions.bypassRateLimit ? "Bebas Limit" : "60 req/min"}
              </p>
            </div>
          </div>
        </section>

        {/* 2. TAB NAVIGASI KOLEKSI PUSTAKA, RIWAYAT BACA & TIKET LAPORAN */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Navigasi Tab */}
            <div className="flex rounded-2xl border border-white/[0.08] bg-[#14141E] p-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${activeTab === "library"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                <BookOpen size={15} />
                <span>Pustaka Saya</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {syncData.library.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${activeTab === "history"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                <History size={15} />
                <span>Riwayat Baca</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {syncData.history.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("reports")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${activeTab === "reports"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                <Inbox size={15} />
                <span>Laporan Saya</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {reports.length}
                </span>
              </button>
            </div>

            {/* Local Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "library"
                    ? "Cari di pustaka komik..."
                    : activeTab === "history"
                      ? "Cari riwayat baca..."
                      : "Cari tiket laporan..."
                }
                className="w-full rounded-xl border border-white/10 bg-[#14141E] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* TAB 1: PUSTAKA SAYA */}
          {activeTab === "library" && (
            <div>
              {filteredLibrary.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredLibrary.map((comic, idx) => (
                    <article
                      key={`${comic.comicId}-${idx}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14141E] transition hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                        {comic.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={comic.coverUrl}
                            alt={comic.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            onError={(e) => {
                              // Fallback placeholder jika gambar gagal dimuat
                              (e.currentTarget as HTMLElement).style.display = "none";
                              const fallback = e.currentTarget.parentElement?.querySelector(".cover-fallback");
                              if (fallback) (fallback as HTMLElement).style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className={`cover-fallback ${comic.coverUrl ? "hidden" : "flex"
                            } h-full w-full flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-indigo-950 p-4 text-center`}
                        >
                          <BookOpen size={32} className="text-slate-600 mb-2" />
                          <span className="text-xs text-slate-400 font-medium line-clamp-2">
                            {comic.title}
                          </span>
                        </div>

                        {/* Badges on cover */}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                          <span className="rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 backdrop-blur-md">
                            {comic.sourceName || "Komik"}
                          </span>
                        </div>
                        {comic.status && (
                          <div className="absolute top-2.5 right-2.5">
                            <span className="rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-md">
                              {comic.status}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <h3 className="font-semibold text-sm text-white line-clamp-1" title={comic.title}>
                            {comic.title}
                          </h3>
                          <p className="mt-1 font-mono text-[11px] text-slate-500 truncate">
                            ID: {comic.comicId}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">
                          <span>Status: Bookmark</span>
                          <span>{relativeTime(comic.updatedAt)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#14141E]/50 py-16 text-center">
                  <BookOpen size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-base font-semibold text-slate-300">
                    {searchQuery ? "Tidak ada komik yang cocok" : "Belum Ada Koleksi Pustaka"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? "Coba kata kunci pencarian yang lain."
                      : "Buka aplikasi Android Komryuu.x, bookmark komik favorit Anda, lalu lakukan sinkronisasi cloud."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RIWAYAT BACA */}
          {activeTab === "history" && (
            <div>
              {filteredHistory.length > 0 ? (
                <div className="space-y-3">
                  {filteredHistory.map((item, idx) => (
                    <div
                      key={`${item.comicId}-${idx}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#14141E] p-4 transition hover:border-indigo-500/30"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-900 border border-white/10">
                          {item.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.coverUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-600">
                              <BookOpen size={16} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm text-white truncate max-w-xs sm:max-w-md" title={item.title}>
                            {item.title}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-300">
                              {item.lastChapterTitle || `Chapter ${item.lastChapterNumber || "-"}`}
                            </span>
                            {item.lastPage > 0 && (
                              <span className="text-slate-400 text-[11px]">
                                Halaman {item.lastPage}
                              </span>
                            )}
                            <span className="text-slate-500 text-[11px]">• {item.sourceName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <span className="block text-xs text-slate-400 font-medium">
                          {relativeTime(item.updatedAt)}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-slate-600 truncate max-w-[120px]">
                          {item.comicId}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#14141E]/50 py-16 text-center">
                  <History size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-base font-semibold text-slate-300">
                    {searchQuery ? "Tidak ada riwayat yang cocok" : "Belum Ada Riwayat Baca"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? "Coba kata kunci pencarian yang lain."
                      : "Mulai baca komik di aplikasi Android Komryuu.x, progress membaca Anda akan otomatis tercatat di sini."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LAPORAN SAYA */}
          {activeTab === "reports" && (
            <div>
              {reportsLoading ? (
                <div className="flex justify-center py-16 text-center text-xs text-slate-400">
                  <Loader2 size={24} className="animate-spin text-indigo-500 mb-2" />
                </div>
              ) : filteredReports.length > 0 ? (
                <div className="space-y-4">
                  {filteredReports.map((report) => (
                    <article
                      key={report.id}
                      className="rounded-2xl border border-white/[0.08] bg-[#14141E] p-5 transition hover:border-indigo-500/30"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            {/* Type badge */}
                            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 capitalize">
                              {report.type.replace("_", " ")}
                            </span>

                            {/* Status badge */}
                            {report.status === "resolved" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                                <CheckCircle2 size={12} /> Selesai
                              </span>
                            ) : report.status === "in_progress" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                                <Wrench size={12} /> Diproses
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                                <Clock size={12} /> Menunggu
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-base text-white">{report.title}</h3>
                          <p className="mt-1 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {report.description}
                          </p>
                        </div>

                        <span className="text-[11px] text-slate-500 flex-shrink-0 font-mono">
                          {formatSafeDate(report.createdAt)}
                        </span>
                      </div>

                      {/* Detail Info: Sumber, Komik, URL */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400 border-t border-white/[0.06] pt-3">
                        {report.extensionName && (
                          <span className="flex items-center gap-1 text-indigo-300">
                            <Layers size={13} />
                            <span>{report.extensionName}</span>
                          </span>
                        )}
                        {report.chapterTitle && (
                          <span>Chapter: {report.chapterTitle}</span>
                        )}
                        {report.targetUrl && (
                          <a
                            href={report.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-400 hover:text-sky-300 underline"
                          >
                            <Globe size={12} />
                            <span className="truncate max-w-[200px]">{report.targetUrl}</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      {/* Admin Note Box if Present */}
                      {report.adminNote && (
                        <div className="mt-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs text-emerald-200">
                          <p className="font-semibold flex items-center gap-1.5 text-emerald-300 mb-1">
                            <FileText size={14} />
                            <span>Respon Balasan Admin:</span>
                          </p>
                          <p className="whitespace-pre-wrap leading-relaxed text-slate-200">
                            {report.adminNote}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#14141E]/50 py-16 text-center">
                  <Inbox size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-base font-semibold text-slate-300">
                    {searchQuery ? "Tidak ada tiket yang cocok" : "Belum Ada Tiket Laporan"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? "Coba kata kunci pencarian yang lain."
                      : "Jika Anda menemukan chapter rusak atau error pada aplikasi Android, kirim laporan dari menu bantuan aplikasi."}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
