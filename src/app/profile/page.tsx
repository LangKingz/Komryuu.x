"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  Globe,
  HardDrive,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  Smartphone,
  User as UserIcon,
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

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{
    role: string;
    permissions: {
      canAccessAdminPanel: boolean;
      bypassRateLimit: boolean;
      canAccessNsfw: boolean;
    };
    isBanned: boolean;
    banReason: string;
    createdAt?: unknown;
    lastLoginAt?: unknown;
  } | null>(null);

  const [syncData, setSyncData] = useState<{
    library: ComicBookmark[];
    history: ReadingHistory[];
    lastSyncedAt: string | null;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"library" | "history">("library");

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

      // Listen dokumen profil user
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
            permissions: {
              canAccessAdminPanel: perms.canAccessAdminPanel === true,
              bypassRateLimit: perms.bypassRateLimit === true,
              canAccessNsfw: perms.canAccessNsfw === true,
            },
            isBanned: d.isBanned === true,
            banReason: typeof d.banReason === "string" ? d.banReason : "",
            createdAt: d.createdAt,
            lastLoginAt: d.lastLoginAt,
          });

          // Ambil data sinkronisasi cloud
          try {
            const backupSnap = await getDoc(doc(db, "USERS", user.uid, "sync_data", "backup"));
            if (backupSnap.exists()) {
              const bData = backupSnap.data();
              setSyncData({
                library: Array.isArray(bData.library) ? (bData.library as ComicBookmark[]) : [],
                history: Array.isArray(bData.history) ? (bData.history as ReadingHistory[]) : [],
                lastSyncedAt: typeof bData.lastSyncedAt === "string" ? bData.lastSyncedAt : null,
              });
            } else {
              setSyncData({ library: [], history: [], lastSyncedAt: null });
            }
          } catch (err) {
            console.error("Error loading sync data in profile:", err);
          }
        }
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [router]);

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "komryuu_session=; path=/; max-age=0;";
    document.cookie = "komryuu_role=; path=/; max-age=0;";
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#14141e] text-white">
        <Loader2 size={36} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const isVip = userData?.role === "vip";
  const isAdminOrMod = userData?.role === "admin" || userData?.role === "moderator";

  return (
    <div className="min-h-screen bg-[#14141e] text-white selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar Header */}
      <header className="border-b border-white/[0.08] bg-[#1c1c28]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md">
              <Zap size={18} />
            </div>
            <span className="font-bold text-lg text-white">Komryuu.x</span>
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              Portal Pengguna
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {isAdminOrMod && (
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
              >
                <Shield size={14} />
                <span>Buka Admin Dashboard</span>
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

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* USER PROFILE HERO CARD */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1c1c28] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt=""
                  className="h-20 w-20 rounded-2xl border-2 border-indigo-500/30 object-cover shadow-xl"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl">
                  <UserIcon size={36} />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    {currentUser?.displayName || "Pengguna Komryuu"}
                  </h1>
                  {isVip ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                      <Crown size={12} /> VIP Member
                    </span>
                  ) : isAdminOrMod ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                      <Shield size={12} /> {userData?.role?.toUpperCase()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                      User Standar
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-400">{currentUser?.email}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">
                  UID: {currentUser?.uid}
                </p>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-400">
                <CheckCircle2 size={13} />
                <span>Akun Terverifikasi</span>
              </span>
              <span className="text-slate-400 text-[11px]">
                Sinkronisasi Cloud:{" "}
                <strong className="text-sky-300">
                  {syncData?.lastSyncedAt ? "Aktif" : "Belum Ada Data"}
                </strong>
              </span>
            </div>
          </div>

          {/* PERMISSIONS / FEATURES SUMMARY */}
          <div className="mt-6 border-t border-white/[0.06] pt-6 grid gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-2xl border border-white/[0.06] bg-[#14141e] p-4">
              <p className="text-slate-400">Rate Limit API</p>
              <p className="mt-1 font-semibold text-white">
                {userData?.permissions.bypassRateLimit ? "Bebas Limit (VIP/Admin)" : "Standar (60 req/min)"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#14141e] p-4">
              <p className="text-slate-400">Filter Konten NSFW 18+</p>
              <p className="mt-1 font-semibold text-white">
                {userData?.permissions.canAccessNsfw ? "Diizinkan" : "Terkunci (Standar)"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-[#14141e] p-4">
              <p className="text-slate-400">Akses Panel Kontrol</p>
              <p className="mt-1 font-semibold text-white">
                {isAdminOrMod ? "Akses Penuh (Admin)" : "Tidak Ada Akses"}
              </p>
            </div>
          </div>
        </div>

        {/* CLOUD SYNC SECTION */}
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <HardDrive size={20} className="text-indigo-400" />
                <span>Koleksi Pustaka &amp; Riwayat Cloud Sync</span>
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Data komik yang tersinkronisasi dari aplikasi Android Komryuu.x milik Anda.
              </p>
            </div>

            {/* TAB BUTTONS */}
            <div className="flex rounded-xl border border-white/[0.08] bg-[#1c1c28] p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className={`rounded-lg px-3.5 py-1.5 font-medium transition ${
                  activeTab === "library"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Bookmark Komik ({syncData?.library.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`rounded-lg px-3.5 py-1.5 font-medium transition ${
                  activeTab === "history"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Riwayat Baca ({syncData?.history.length || 0})
              </button>
            </div>
          </div>

          {/* SYNC CONTENT */}
          <div className="mt-5">
            {activeTab === "library" ? (
              syncData?.library && syncData.library.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {syncData.library.map((item, idx) => (
                    <div
                      key={`${item.comicId}-${idx}`}
                      className="flex gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4 text-left transition hover:border-indigo-500/30"
                    >
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt=""
                          className="h-20 w-14 flex-shrink-0 rounded-xl object-cover border border-white/10"
                        />
                      ) : (
                        <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#14141e] text-slate-500 border border-white/10">
                          <BookOpen size={20} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm text-white truncate">{item.title}</h4>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                            {item.sourceName || "Komik"}
                          </span>
                          {item.status && (
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-[11px] text-slate-500">
                          ID: <span className="font-mono">{item.comicId}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#1c1c28]/40 py-16 text-center">
                  <BookOpen size={36} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-300">Belum Ada Bookmark Komik</p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Simpan komik favorit di aplikasi Android Komryuu.x dan lakukan sinkronisasi akun.
                  </p>
                </div>
              )
            ) : syncData?.history && syncData.history.length > 0 ? (
              <div className="space-y-3">
                {syncData.history.map((item, idx) => (
                  <div
                    key={`${item.comicId}-${idx}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4 transition hover:border-indigo-500/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt=""
                          className="h-14 w-11 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[#14141e] text-slate-500">
                          <BookOpen size={16} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-white truncate">{item.title}</h4>
                        <p className="mt-0.5 text-xs text-indigo-300">
                          {item.lastChapterTitle || `Chapter ${item.lastChapterNumber || "-"}`}
                          {item.lastPage ? ` • Halaman ${item.lastPage}` : ""}
                        </p>
                        <span className="text-[10px] text-slate-500">{item.sourceName}</span>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-right text-xs text-slate-400">
                      ID: {item.comicId}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#1c1c28]/40 py-16 text-center">
                <Clock size={36} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-300">Belum Ada Riwayat Baca</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Mulai membaca komik di aplikasi Android dan progress Anda akan otomatis tercatat di sini.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
