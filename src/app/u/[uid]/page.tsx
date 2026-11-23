"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Lock,
  Search,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
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

interface PublicUserData {
  uid: string;
  name: string;
  photoURL?: string;
  role: string;
  isPublicLibrary: boolean;
  libraryCount?: number;
  historyCount?: number;
  lastSyncedAt?: string;
  createdAt?: string;
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

export default function PublicUserLibraryPage() {
  const params = useParams();
  const uid = typeof params?.uid === "string" ? params.uid : "";

  const [loading, setLoading] = useState(true);
  const [userNotFound, setUserNotFound] = useState(false);
  const [userData, setUserData] = useState<PublicUserData | null>(null);
  const [library, setLibrary] = useState<ComicBookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setUserNotFound(true);
      return;
    }

    async function loadPublicData() {
      try {
        setLoading(true);
        const userRef = doc(db, "USERS", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setUserNotFound(true);
          setLoading(false);
          return;
        }

        const data = userSnap.data();
        const isPublic = data.isPublicLibrary === true;

        const role = typeof data.role === "string" ? data.role.toLowerCase() : "user";
        const name = typeof data.name === "string" && data.name
          ? data.name
          : typeof data.displayName === "string" && data.displayName
          ? data.displayName
          : "Pengguna Komryuu";

        setUserData({
          uid,
          name,
          photoURL: typeof data.photoURL === "string" ? data.photoURL : undefined,
          role,
          isPublicLibrary: isPublic,
          libraryCount: typeof data.libraryCount === "number" ? data.libraryCount : undefined,
          historyCount: typeof data.historyCount === "number" ? data.historyCount : undefined,
          lastSyncedAt: typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : undefined,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
        });

        // If public, load library from backup subcollection first, fallback to user doc
        if (isPublic) {
          let items: ComicBookmark[] = [];

          try {
            const backupSnap = await getDoc(doc(db, "USERS", uid, "sync_data", "backup"));
            if (backupSnap.exists()) {
              const bData = backupSnap.data();
              const rawLib = bData.library || bData.pustaka || bData.bookmarks || [];
              if (Array.isArray(rawLib)) {
                items = rawLib.map(normalizeComicBookmark).filter((i): i is ComicBookmark => i !== null);
              }
            }
          } catch (bErr) {
            console.warn("Could not load backup subcollection:", bErr);
          }

          if (items.length === 0 && Array.isArray(data.library)) {
            items = data.library.map(normalizeComicBookmark).filter((i): i is ComicBookmark => i !== null);
          }

          setLibrary(items);
        }
      } catch (err) {
        console.error("Failed to load public library", err);
        setUserNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    void loadPublicData();
  }, [uid]);

  // Unique sources
  const sources = useMemo(() => {
    const set = new Set<string>();
    library.forEach((item) => {
      if (item.sourceName) set.add(item.sourceName);
    });
    return Array.from(set);
  }, [library]);

  // Filtered library
  const filteredLibrary = useMemo(() => {
    let result = library;
    if (selectedSource !== "all") {
      result = result.filter((item) => item.sourceName === selectedSource);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.sourceName.toLowerCase().includes(q) ||
          item.comicId.toLowerCase().includes(q)
      );
    }
    return result;
  }, [library, selectedSource, searchQuery]);

  function copyShareLink() {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-400">Memuat pustaka publik...</p>
        </div>
      </div>
    );
  }

  if (userNotFound || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-4 text-white">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-[#14141E] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
            <Lock size={28} />
          </div>
          <h1 className="text-xl font-bold text-white">Pengguna Tidak Ditemukan</h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Akun dengan UID tersebut tidak terdaftar atau telah dinonaktifkan dari sistem Komryuu.x.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If user set their library to private
  if (!userData.isPublicLibrary) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white selection:bg-indigo-500 selection:text-white">
        <header className="border-b border-white/[0.08] bg-[#14141E]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-sm">
                K
              </div>
              <span className="font-bold text-white text-base">Komryuu<span className="text-indigo-400">.x</span></span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={14} />
              <span>Beranda</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <div className="rounded-3xl border border-white/10 bg-[#14141E] p-8 sm:p-10 shadow-2xl">
            <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-5 border border-amber-500/20">
              <Lock size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">Pustaka Koleksi Bersifat Privat</h1>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              <strong>{userData.name}</strong> belum mengaktifkan fitur <em>Pustaka Publik</em>. Koleksi bookmark dan riwayat baca hanya dapat dilihat oleh pemilik akun.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30"
              >
                <span>Jelajahi Komryuu.x</span>
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.05] transition"
              >
                <span>Masuk ke Akun Anda</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isVip = userData.role === "vip";
  const isAdmin = userData.role === "admin";
  const isModerator = userData.role === "moderator";

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
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
            <span className="hidden sm:inline-flex rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              Pustaka Publik
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
              <span>{copied ? "Link Disalin!" : "Bagikan Pustaka"}</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Beranda</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
        {/* User Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#14141E] p-6 sm:p-8 shadow-2xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {userData.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userData.photoURL}
                  alt={userData.name}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-2 border-purple-500/30 object-cover shadow-xl"
                />
              ) : (
                <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl">
                  <UserIcon size={40} />
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">
                    Pustaka {userData.name}
                  </h1>

                  {/* Role Badge */}
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

                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Publik
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-slate-400 max-w-lg leading-relaxed">
                  Koleksi manga, manhwa, dan komik pilihan yang tersinkronisasi langsung dari aplikasi Android Komryuu.x.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-slate-300">
                    <strong className="text-white">{library.length}</strong> Komik Disimpan
                  </span>
                  <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-slate-300">
                    <strong className="text-white">{sources.length}</strong> Sumber Ekstensi
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2.5">
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/25 hover:scale-[1.02] transition"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Link Disalin ke Clipboard" : "Salin Link Pustaka"}</span>
              </button>

              <Link
                href="/#download"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition"
              >
                <Smartphone size={13} />
                <span>Download Aplikasi Android</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Source Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setSelectedSource("all")}
              className={`rounded-xl px-3.5 py-1.5 font-semibold transition ${
                selectedSource === "all"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-[#14141E] text-slate-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              Semua ({library.length})
            </button>
            {sources.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setSelectedSource(src)}
                className={`rounded-xl px-3 py-1.5 font-semibold whitespace-nowrap transition ${
                  selectedSource === src
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-[#14141E] text-slate-400 hover:text-white border border-white/[0.06]"
                }`}
              >
                {src}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul komik..."
              className="w-full rounded-xl border border-white/10 bg-[#14141E] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-purple-500 transition"
            />
          </div>
        </div>

        {/* Comics Grid */}
        {filteredLibrary.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredLibrary.map((comic, idx) => (
              <article
                key={`${comic.comicId}-${idx}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14141E] transition duration-200 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                  {comic.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comic.coverUrl}
                      alt={comic.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                        const fallback = e.currentTarget.parentElement?.querySelector(".cover-fallback");
                        if (fallback) (fallback as HTMLElement).style.display = "flex";
                      }}
                    />
                  ) : null}

                  <div
                    className={`cover-fallback ${
                      comic.coverUrl ? "hidden" : "flex"
                    } h-full w-full flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-purple-950 p-4 text-center`}
                  >
                    <BookOpen size={32} className="text-slate-600 mb-2" />
                    <span className="text-xs text-slate-400 font-medium line-clamp-2">
                      {comic.title}
                    </span>
                  </div>

                  {/* Source Name Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="rounded-lg bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-purple-300 backdrop-blur-md border border-white/10">
                      {comic.sourceName || "Komik"}
                    </span>
                  </div>

                  {comic.status && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="rounded-lg bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-md border border-white/10">
                        {comic.status}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3
                      className="font-semibold text-sm text-white line-clamp-2 group-hover:text-purple-300 transition-colors"
                      title={comic.title}
                    >
                      {comic.title}
                    </h3>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">
                    <span className="truncate max-w-[130px]">{comic.sourceName}</span>
                    <span className="font-mono text-[10px] text-slate-500">Tersinkron</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#14141E]/50 py-16 text-center">
            <BookOpen size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-base font-semibold text-slate-300">
              {searchQuery ? "Tidak ada komik yang cocok" : "Pustaka Masih Kosong"}
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? "Coba gunakan kata kunci pencarian yang lain."
                : "Pengguna ini belum menambahkan komik ke daftar bookmark mereka."}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/[0.08] bg-[#101018] py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Komryuu.x • Unified Comic Ecosystem</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/" className="hover:text-white transition">Beranda</Link>
            <Link href="/#download" className="hover:text-white transition">Download Android</Link>
            <Link href="/profile" className="hover:text-white transition">Profil Anda</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
