"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  BookOpen,
  ClockCounterClockwise,
  Copy,
  Crown,
  Devices,
  Eye,
  MagnifyingGlass,
  PencilSimple,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Trash,
  User,
  UserCircle,
  UserMinus,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";

export type UserRole = "admin" | "moderator" | "vip" | "user";

export type UserPermissions = {
  canAccessAdminPanel: boolean;
  canManageExtensions: boolean;
  canBanUsers: boolean;
  bypassRateLimit: boolean;
  canAccessNsfw: boolean;
};

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canAccessAdminPanel: true,
    canManageExtensions: true,
    canBanUsers: true,
    bypassRateLimit: true,
    canAccessNsfw: true,
  },
  moderator: {
    canAccessAdminPanel: true,
    canManageExtensions: true,
    canBanUsers: true,
    bypassRateLimit: false,
    canAccessNsfw: true,
  },
  vip: {
    canAccessAdminPanel: false,
    canManageExtensions: false,
    canBanUsers: false,
    bypassRateLimit: true,
    canAccessNsfw: true,
  },
  user: {
    canAccessAdminPanel: false,
    canManageExtensions: false,
    canBanUsers: false,
    bypassRateLimit: false,
    canAccessNsfw: false,
  },
};

type FilterType = "all" | "active" | "banned" | "admin" | "moderator" | "vip" | "user";
type ModalType = "ban" | "delete" | "role" | "reason" | "sync" | null;

export type ComicBookmark = {
  comicId: string;
  title: string;
  coverUrl: string;
  sourceName: string;
  status: string;
  updatedAt: string | number;
};

export type ReadingHistory = {
  comicId: string;
  title: string;
  coverUrl: string;
  sourceName: string;
  lastChapterNumber: string | number;
  lastChapterTitle: string;
  lastPage: number;
  updatedAt: string | number;
};

export type UserSyncBackup = {
  library: ComicBookmark[];
  history: ReadingHistory[];
  lastSyncedAt: string | null;
};

type UserRecord = {
  id: string;
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
  provider: string;
  role: UserRole;
  permissions: UserPermissions;
  isBanned: boolean;
  banReason: string;
  bannedAt: unknown;
  deviceInfo: {
    platform: string;
    appVersion: string;
    deviceModel: string;
  };
  libraryCount?: number;
  historyCount?: number;
  lastSyncedAt?: unknown;
  rawLibrary?: unknown;
  rawHistory?: unknown;
  library?: ComicBookmark[];
  history?: ReadingHistory[];
  createdAt: unknown;
  lastLoginAt: unknown;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const date = toDate.call(value);
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
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
      ? rec.updatedAt
      : rec.updated_at !== undefined
      ? rec.updated_at
      : rec.timestamp !== undefined
      ? rec.timestamp
      : rec.waktu !== undefined
      ? rec.waktu
      : Date.now();

  return {
    comicId: comicId || `comic-${Date.now()}`,
    title: title || "Tanpa Judul",
    coverUrl,
    sourceName: sourceName || "Sumber Komik",
    status,
    updatedAt: typeof updatedAt === "number" || typeof updatedAt === "string" ? updatedAt : Date.now(),
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
      ? rec.lastChapterNumber
      : rec.last_chapter_number !== undefined
      ? rec.last_chapter_number
      : rec.chapter !== undefined
      ? rec.chapter
      : rec.lastChapter !== undefined
      ? rec.lastChapter
      : rec.last_chapter !== undefined
      ? rec.last_chapter
      : rec.chapterNumber !== undefined
      ? rec.chapterNumber
      : rec.bab !== undefined
      ? rec.bab
      : rec.nomorBab !== undefined
      ? rec.nomorBab
      : "-";

  const lastChapterTitle = String(
    rec.lastChapterTitle || rec.last_chapter_title || rec.chapterTitle || rec.judulChapter || rec.judul_bab || rec.chapterName || ""
  ).trim();

  const lastPage = Number(rec.lastPage || rec.last_page || rec.page || rec.halaman || 0);

  const updatedAt =
    rec.updatedAt !== undefined
      ? rec.updatedAt
      : rec.updated_at !== undefined
      ? rec.updated_at
      : rec.timestamp !== undefined
      ? rec.timestamp
      : rec.waktu !== undefined
      ? rec.waktu
      : Date.now();

  return {
    comicId: comicId || `history-${Date.now()}`,
    title: title || "Tanpa Judul",
    coverUrl,
    sourceName: sourceName || "Sumber Komik",
    lastChapterNumber: typeof lastChapterNumber === "string" || typeof lastChapterNumber === "number" ? lastChapterNumber : "-",
    lastChapterTitle,
    lastPage: isNaN(lastPage) ? 0 : lastPage,
    updatedAt: typeof updatedAt === "number" || typeof updatedAt === "string" ? updatedAt : Date.now(),
  };
}

function toUser(id: string, data: Record<string, unknown>): UserRecord {
  const device =
    data.deviceInfo && typeof data.deviceInfo === "object"
      ? (data.deviceInfo as Record<string, unknown>)
      : {};
  const rawRole = toText(data.role).toLowerCase();
  const role: UserRole =
    rawRole === "admin" || rawRole === "moderator" || rawRole === "vip"
      ? (rawRole as UserRole)
      : "user";

  const rawPerms =
    data.permissions && typeof data.permissions === "object"
      ? (data.permissions as Record<string, unknown>)
      : {};
  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role];
  const permissions: UserPermissions = {
    canAccessAdminPanel:
      typeof rawPerms.canAccessAdminPanel === "boolean"
        ? rawPerms.canAccessAdminPanel
        : defaultPerms.canAccessAdminPanel,
    canManageExtensions:
      typeof rawPerms.canManageExtensions === "boolean"
        ? rawPerms.canManageExtensions
        : defaultPerms.canManageExtensions,
    canBanUsers:
      typeof rawPerms.canBanUsers === "boolean"
        ? rawPerms.canBanUsers
        : defaultPerms.canBanUsers,
    bypassRateLimit:
      typeof rawPerms.bypassRateLimit === "boolean"
        ? rawPerms.bypassRateLimit
        : defaultPerms.bypassRateLimit,
    canAccessNsfw:
      typeof rawPerms.canAccessNsfw === "boolean"
        ? rawPerms.canAccessNsfw
        : defaultPerms.canAccessNsfw,
  };

  const rawLib = data.library || data.pustaka || data.bookmarks || data.bookmark || data.koleksi;
  const rawHist = data.history || data.riwayat || data.readingHistory || data.baca;

  const library = Array.isArray(rawLib)
    ? (rawLib.map(normalizeComicBookmark).filter((i): i is ComicBookmark => i !== null) as ComicBookmark[])
    : [];

  const history = Array.isArray(rawHist)
    ? (rawHist.map(normalizeReadingHistory).filter((i): i is ReadingHistory => i !== null) as ReadingHistory[])
    : [];

  const libraryCount =
    typeof data.libraryCount === "number"
      ? data.libraryCount
      : library.length;

  const historyCount =
    typeof data.historyCount === "number"
      ? data.historyCount
      : history.length;

  return {
    id,
    uid: toText(data.uid) || id,
    name: toText(data.name),
    email: toText(data.email),
    photoUrl: toText(data.photoUrl),
    provider: toText(data.provider).toLowerCase() || "guest",
    role,
    permissions,
    isBanned: data.isBanned === true,
    banReason: toText(data.banReason),
    bannedAt: data.bannedAt,
    deviceInfo: {
      platform: toText(device.platform),
      appVersion: toText(device.appVersion),
      deviceModel: toText(device.deviceModel),
    },
    libraryCount,
    historyCount,
    lastSyncedAt: data.lastSyncedAt || data.updatedAt,
    rawLibrary: rawLib,
    rawHistory: rawHist,
    library,
    history,
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
  };
}

function relativeTime(value: unknown): string {
  const date = parseDate(value);
  if (!date) return "Belum ada aktivitas";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
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

function roleBadgeClass(role: UserRole): string {
  switch (role) {
    case "admin":
      return "border border-rose-400/30 bg-rose-400/10 text-rose-300";
    case "moderator":
      return "border border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "vip":
      return "border border-purple-400/30 bg-purple-400/10 text-purple-300";
    default:
      return "border border-white/[0.08] bg-slate-800 text-slate-300";
  }
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "moderator":
      return "Moderator";
    case "vip":
      return "VIP Member";
    default:
      return "User Standar";
  }
}

export default function UserPages() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [banReason, setBanReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [targetRole, setTargetRole] = useState<UserRole>("user");
  const [targetPermissions, setTargetPermissions] = useState<UserPermissions>(ROLE_DEFAULT_PERMISSIONS.user);
  const [busy, setBusy] = useState(false);

  // State untuk modal sinkronisasi user
  const [syncData, setSyncData] = useState<UserSyncBackup | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncTab, setSyncTab] = useState<"library" | "history">("library");
  const [syncSearch, setSyncSearch] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "USERS"),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => toUser(item.id, item.data())));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setToast({ kind: "error", message: "Gagal memuat data pengguna." });
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const now = Date.now();
  const activeToday = users.filter((user) => {
    const date = parseDate(user.lastLoginAt);
    return date ? date.getTime() >= now - 24 * 60 * 60 * 1000 : false;
  }).length;
  const newThisWeek = users.filter((user) => {
    const date = parseDate(user.createdAt);
    return date ? date.getTime() >= now - 7 * 24 * 60 * 60 * 1000 : false;
  }).length;
  const bannedCount = users.filter((user) => user.isBanned).length;

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.uid.toLowerCase().includes(term);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && !user.isBanned) ||
        (filter === "banned" && user.isBanned) ||
        (filter === "admin" && user.role === "admin") ||
        (filter === "moderator" && user.role === "moderator") ||
        (filter === "vip" && user.role === "vip") ||
        (filter === "user" && user.role === "user");
      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  async function logActivity(action: string, detail: string, userId: string) {
    try {
      await recordAdminActivity(action, detail, userId);
    } catch (logError) {
      console.error("User update succeeded but activity logging failed", logError);
    }
  }

  function openModal(type: ModalType, user: UserRecord) {
    setSelected(user);
    setModal(type);
    setBanReason("");
    setCustomReason("");
    setTargetRole(user.role);
    setTargetPermissions({ ...user.permissions });

    if (type === "sync") {
      setSyncTab("library");
      setSyncSearch("");

      // 1. Membaca data langsung dari user.library & user.history di dokumen USERS/{uid}
      const directLibrary = Array.isArray(user.library) && user.library.length > 0 ? user.library : [];
      const directHistory = Array.isArray(user.history) && user.history.length > 0 ? user.history : [];

      if (directLibrary.length > 0 || directHistory.length > 0) {
        setSyncData({
          library: directLibrary,
          history: directHistory,
          lastSyncedAt: typeof user.lastSyncedAt === "string" ? user.lastSyncedAt : user.lastSyncedAt ? parseDate(user.lastSyncedAt)?.toISOString() || null : null,
        });
        setSyncLoading(false);
      } else {
        setSyncLoading(true);
        setSyncData(null);
      }

      // 2. Sekaligus melakukan fallback fetch ke sub-collection USERS/{uid}/sync_data/backup
      void loadUserSyncData(user);
    }
  }

  async function loadUserSyncData(user: UserRecord) {
    try {
      const candidates = Array.from(new Set([user.uid, user.id].filter(Boolean))) as string[];
      let foundBackup: {
        library: unknown[];
        history: unknown[];
        lastSyncedAt: unknown;
      } | null = null;

      // 1. Coba baca dari subcollection USERS/{target}/sync_data/backup
      for (const targetUid of candidates) {
        try {
          const backupSnap = await getDoc(doc(db, "USERS", targetUid, "sync_data", "backup"));
          if (backupSnap.exists()) {
            const data = backupSnap.data() as Record<string, unknown>;
            const rawLib = data.library || data.pustaka || data.bookmarks || data.bookmark || data.koleksi;
            const rawHist = data.history || data.riwayat || data.readingHistory || data.baca;
            if (Array.isArray(rawLib) || Array.isArray(rawHist)) {
              foundBackup = {
                library: Array.isArray(rawLib) ? rawLib : [],
                history: Array.isArray(rawHist) ? rawHist : [],
                lastSyncedAt: data.lastSyncedAt || data.updatedAt || null,
              };
              console.log(`[UserSync] Ditemukan data sync di USERS/${targetUid}/sync_data/backup:`, {
                library: foundBackup.library.length,
                history: foundBackup.history.length,
              });
              break;
            }
          }
        } catch (err) {
          console.warn(`[UserSync] Gagal membaca subcollection backup untuk ${targetUid}:`, err);
        }
      }

      // 2. Jika belum ketemu, coba scan dokumen lain di subcollection USERS/{target}/sync_data
      if (!foundBackup) {
        for (const targetUid of candidates) {
          try {
            const syncColSnap = await getDocs(collection(db, "USERS", targetUid, "sync_data"));
            for (const docSnap of syncColSnap.docs) {
              const data = docSnap.data() as Record<string, unknown>;
              const rawLib = data.library || data.pustaka || data.bookmarks || data.bookmark || data.koleksi;
              const rawHist = data.history || data.riwayat || data.readingHistory || data.baca;
              if (Array.isArray(rawLib) || Array.isArray(rawHist)) {
                foundBackup = {
                  library: Array.isArray(rawLib) ? rawLib : [],
                  history: Array.isArray(rawHist) ? rawHist : [],
                  lastSyncedAt: data.lastSyncedAt || data.updatedAt || null,
                };
                console.log(`[UserSync] Ditemukan data sync di USERS/${targetUid}/sync_data/${docSnap.id}:`, {
                  library: foundBackup.library.length,
                  history: foundBackup.history.length,
                });
                break;
              }
            }
            if (foundBackup) break;
          } catch (err) {
            console.warn(`[UserSync] Gagal membaca collection sync_data untuk ${targetUid}:`, err);
          }
        }
      }

      // 3. Fallback: Coba periksa dokumen induk USERS/{target}
      if (!foundBackup) {
        for (const targetUid of candidates) {
          try {
            const parentSnap = await getDoc(doc(db, "USERS", targetUid));
            if (parentSnap.exists()) {
              const data = parentSnap.data() as Record<string, unknown>;
              const rawLib = data.library || data.pustaka || data.bookmarks || data.bookmark || data.koleksi;
              const rawHist = data.history || data.riwayat || data.readingHistory || data.baca;
              if (Array.isArray(rawLib) || Array.isArray(rawHist)) {
                foundBackup = {
                  library: Array.isArray(rawLib) ? rawLib : [],
                  history: Array.isArray(rawHist) ? rawHist : [],
                  lastSyncedAt: data.lastSyncedAt || data.updatedAt || null,
                };
                console.log(`[UserSync] Ditemukan data sync di dokumen induk USERS/${targetUid}:`, {
                  library: foundBackup.library.length,
                  history: foundBackup.history.length,
                });
                break;
              }
            }
          } catch (err) {
            console.warn(`[UserSync] Gagal membaca doc induk USERS/${targetUid}:`, err);
          }
        }
      }

      // 4. Fallback ke data user di memori yang sudah menempel di dokumen USERS
      if (!foundBackup && (user.library?.length || user.history?.length || Array.isArray(user.rawLibrary) || Array.isArray(user.rawHistory))) {
        foundBackup = {
          library: (user.library && user.library.length > 0) ? user.library : Array.isArray(user.rawLibrary) ? (user.rawLibrary as unknown[]) : [],
          history: (user.history && user.history.length > 0) ? user.history : Array.isArray(user.rawHistory) ? (user.rawHistory as unknown[]) : [],
          lastSyncedAt: user.lastSyncedAt,
        };
      }

      if (foundBackup) {
        const normalizedLibrary = (foundBackup.library || [])
          .map((item) => normalizeComicBookmark(item))
          .filter((item): item is ComicBookmark => item !== null && (!!item.comicId || !!item.title));

        const normalizedHistory = (foundBackup.history || [])
          .map((item) => normalizeReadingHistory(item))
          .filter((item): item is ReadingHistory => item !== null && (!!item.comicId || !!item.title));

        let lastSyncedString: string | null = null;
        if (typeof foundBackup.lastSyncedAt === "string") {
          lastSyncedString = foundBackup.lastSyncedAt;
        } else if (foundBackup.lastSyncedAt) {
          const parsed = parseDate(foundBackup.lastSyncedAt);
          if (parsed) lastSyncedString = parsed.toISOString();
        }

        setSyncData({
          library: normalizedLibrary,
          history: normalizedHistory,
          lastSyncedAt: lastSyncedString,
        });
      } else {
        setSyncData((prev) => prev ?? {
          library: user.library || [],
          history: user.history || [],
          lastSyncedAt: typeof user.lastSyncedAt === "string" ? user.lastSyncedAt : null,
        });
      }
    } catch (err) {
      console.error("Load sync data failed", err);
      setSyncData((prev) => prev ?? {
        library: user.library || [],
        history: user.history || [],
        lastSyncedAt: typeof user.lastSyncedAt === "string" ? user.lastSyncedAt : null,
      });
    } finally {
      setSyncLoading(false);
    }
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setSelected(null);
    setSyncData(null);
  }

  async function copyUid(uid: string) {
    try {
      await navigator.clipboard.writeText(uid);
      setToast({ kind: "success", message: "UID berhasil disalin." });
    } catch {
      setToast({ kind: "error", message: "Gagal menyalin UID." });
    }
  }

  async function banUser() {
    if (!selected) return;
    const reason = (customReason.trim() || banReason).trim();
    if (!reason) {
      setToast({ kind: "error", message: "Alasan banned wajib diisi." });
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "USERS", selected.id), {
        isBanned: true,
        banReason: reason,
        bannedAt: serverTimestamp(),
      });
      await logActivity("Pengguna dibanned", `${selected.name || selected.email}: ${reason}`, selected.id);
      setToast({ kind: "success", message: "Pengguna berhasil dibanned." });
      closeModal();
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal membanned pengguna.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function unbanUser(user: UserRecord) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "USERS", user.id), {
        isBanned: false,
        banReason: "",
        bannedAt: null,
      });
      await logActivity("Pengguna dipulihkan", user.name || user.email, user.id);
      setToast({ kind: "success", message: "Pengguna berhasil dipulihkan." });
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal memulihkan pengguna.",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleRoleChange(newRole: UserRole) {
    setTargetRole(newRole);
    // Otomatis terapkan preset permissions default untuk role tersebut
    setTargetPermissions({ ...ROLE_DEFAULT_PERMISSIONS[newRole] });
  }

  function togglePermission(key: keyof UserPermissions) {
    setTargetPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function saveRoleAndPermissions() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "USERS", selected.id), {
        role: targetRole,
        permissions: targetPermissions,
      });
      await logActivity(
        "Role & hak akses diubah",
        `${selected.name || selected.email}: Role=${targetRole}`,
        selected.id
      );
      setToast({ kind: "success", message: `Role dan hak akses untuk ${selected.name || selected.email} berhasil diperbarui.` });
      closeModal();
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal memperbarui hak akses.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "USERS", selected.id));
      await logActivity("Data pengguna dihapus", selected.name || selected.email, selected.id);
      setToast({ kind: "success", message: "Data pengguna berhasil dihapus." });
      closeModal();
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal menghapus data pengguna.",
      });
    } finally {
      setBusy(false);
    }
  }

  const filterTabs: Array<{ value: FilterType; label: string }> = [
    { value: "all", label: "Semua User" },
    { value: "active", label: "Aktif" },
    { value: "banned", label: "Dibanned" },
    { value: "admin", label: "Admin" },
    { value: "moderator", label: "Moderator" },
    { value: "vip", label: "VIP" },
    { value: "user", label: "User" },
  ];

  // Filtered items untuk modal sinkronisasi
  const filteredLibrary = useMemo(() => {
    if (!syncData?.library) return [];
    const term = syncSearch.trim().toLowerCase();
    if (!term) return syncData.library;
    return syncData.library.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.sourceName.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term)
    );
  }, [syncData, syncSearch]);

  const filteredHistory = useMemo(() => {
    if (!syncData?.history) return [];
    const term = syncSearch.trim().toLowerCase();
    if (!term) return syncData.history;
    return syncData.history.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.sourceName.toLowerCase().includes(term) ||
        String(item.lastChapterTitle || "").toLowerCase().includes(term)
    );
  }, [syncData, syncSearch]);

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Monitoring & RBAC</p>
          <h1 className="mt-2 text-3xl font-semibold">Manajemen Pengguna</h1>
          <p className="mt-2 text-sm text-slate-400">
            Kelola role, hak akses granular, status pemblokiran, dan monitor riwayat baca cloud.
          </p>
        </header>

        {toast && (
          <div
            role={toast.kind === "error" ? "alert" : "status"}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              toast.kind === "error"
                ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            }`}
          >
            {toast.message}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {/* METRICS CARDS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Pengguna", value: users.length, icon: UserCircle, color: "text-sky-300", bg: "bg-sky-400/10" },
            { label: "Aktif Hari Ini", value: activeToday, icon: UserPlus, color: "text-emerald-300", bg: "bg-emerald-400/10" },
            { label: "Pengguna Baru (7 Hari)", value: newThisWeek, icon: Devices, color: "text-violet-300", bg: "bg-violet-400/10" },
            { label: "Total Akun Dibanned", value: bannedCount, icon: ShieldWarning, color: "text-rose-300", bg: "bg-rose-400/10" },
          ].map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold">{loading ? "—" : stat.value}</p>
                </div>
                <span className={`rounded-xl p-2.5 ${stat.bg} ${stat.color}`}>
                  <stat.icon size={22} weight="duotone" />
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* CONTROLS: FILTER TABS & SEARCH */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filter === tab.value
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:max-w-sm">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, email, atau UID..."
              aria-label="Cari pengguna"
              className="w-full rounded-xl border border-white/[0.08] bg-[#14141e] py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 transition"
            />
          </div>
        </div>

        {/* USERS TABLE */}
        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] py-16 text-center text-slate-300">
            Memuat pengguna...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] py-16 text-center text-slate-400">
            {users.length ? "Tidak ada pengguna yang cocok dengan pencarian/filter." : "Belum ada data pengguna di database."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1c1c28]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Pengguna</th>
                    <th className="px-5 py-4">Perangkat & Info</th>
                    <th className="px-5 py-4">Aktivitas Terakhir</th>
                    <th className="px-5 py-4">Role & Hak Akses</th>
                    <th className="px-5 py-4">Cloud Sync</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="transition hover:bg-white/[0.02]">
                      {/* 1. Pengguna */}
                      <td className="px-5 py-4">
                        <div className="flex min-w-[220px] items-center gap-3">
                          {user.photoUrl ? (
                            <img
                              src={user.photoUrl}
                              alt=""
                              className="h-10 w-10 rounded-full border border-white/10 object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                              <UserCircle size={24} weight="duotone" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{user.name || "Tanpa Nama"}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">{user.email || "-"}</p>
                            <button
                              type="button"
                              onClick={() => void copyUid(user.uid)}
                              className="mt-1 flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-sky-300 transition"
                              title="Salin UID"
                            >
                              <span className="max-w-[150px] truncate">{user.uid}</span>
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 2. Perangkat */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            user.provider === "google"
                              ? "bg-sky-400/10 text-sky-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {user.provider === "google" ? "Google Account" : "Guest / Direct"}
                        </span>
                        <p className="mt-1.5 max-w-[160px] truncate text-xs text-slate-400">
                          {user.deviceInfo.appVersion ? `v${user.deviceInfo.appVersion}` : "v1.0.0"} •{" "}
                          {user.deviceInfo.deviceModel || "Android Device"}
                        </p>
                      </td>

                      {/* 3. Login Terakhir */}
                      <td className="px-5 py-4 text-sm text-slate-300">
                        {relativeTime(user.lastLoginAt)}
                      </td>

                      {/* 4. Role & Hak Akses */}
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openModal("role", user)}
                          className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${roleBadgeClass(
                            user.role
                          )}`}
                          title="Klik untuk ubah role & permissions"
                        >
                          {user.role === "admin" && <ShieldCheck size={14} weight="fill" />}
                          {user.role === "moderator" && <ShieldWarning size={14} weight="fill" />}
                          {user.role === "vip" && <Crown size={14} weight="fill" />}
                          {user.role === "user" && <User size={14} weight="bold" />}
                          <span>{roleLabel(user.role)}</span>
                          <PencilSimple size={12} className="opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      </td>

                      {/* 5. Cloud Sync Monitoring */}
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openModal("sync", user)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/20 transition"
                          title="Buka detail koleksi & riwayat baca"
                        >
                          <BookOpen size={14} weight="duotone" />
                          <span>Koleksi</span>
                          {(typeof user.libraryCount === "number" || typeof user.historyCount === "number") && (
                            <span className="ml-0.5 rounded-full bg-sky-400/20 px-1.5 py-0.2 text-[10px] text-sky-200">
                              {(user.libraryCount || 0) + (user.historyCount || 0)}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* 6. Status */}
                      <td className="px-5 py-4">
                        {user.isBanned ? (
                          <button
                            type="button"
                            onClick={() => openModal("reason", user)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300 hover:bg-rose-400/20 transition"
                            title="Lihat alasan banned"
                          >
                            <ShieldWarning size={13} weight="bold" />
                            Banned
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                            Aktif
                          </span>
                        )}
                      </td>

                      {/* 7. Aksi */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.isBanned ? (
                            <button
                              type="button"
                              onClick={() => void unbanUser(user)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50 transition"
                            >
                              <UserPlus size={14} weight="bold" />
                              Unban
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openModal("ban", user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-400/10 transition"
                            >
                              <UserMinus size={14} weight="bold" />
                              Ban
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openModal("delete", user)}
                            aria-label={`Hapus ${user.email || user.name}`}
                            className="rounded-lg border border-white/[0.08] p-1.5 text-slate-400 hover:border-rose-400/40 hover:text-rose-300 transition"
                            title="Hapus user secara permanen"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL HANDLERS */}
        {modal && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-action-title"
              className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#1c1c28] p-5 shadow-2xl sm:p-6 ${
                modal === "sync" ? "max-w-3xl" : "max-w-lg"
              }`}
            >
              <header className="mb-5 flex items-start justify-between border-b border-white/[0.07] pb-4">
                <div>
                  <h2 id="user-action-title" className="text-xl font-semibold text-white">
                    {modal === "ban" && "Banned Pengguna"}
                    {modal === "delete" && "Hapus Data Pengguna"}
                    {modal === "role" && "Kelola Role & Hak Akses Pengguna"}
                    {modal === "reason" && "Detail Alasan Banned"}
                    {modal === "sync" && "Koleksi Pustaka & Riwayat User"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {selected.name || "Tanpa Nama"} • {selected.email || selected.uid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  aria-label="Tutup modal"
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </header>

              {/* MODAL 1: KELOLA ROLE & HAK AKSES */}
              {modal === "role" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Pilih Role Akun</label>
                    <select
                      value={targetRole}
                      onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                      className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-[#14141e] px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 transition"
                    >
                      <option value="admin">Admin (Akses penuh dashboard & konfigurasi API)</option>
                      <option value="moderator">Moderator (Kelola ekstensi komik & ban user)</option>
                      <option value="vip">VIP Member (Bypass rate limit & fitur premium)</option>
                      <option value="user">User Standar (Pengguna aplikasi biasa)</option>
                    </select>
                  </div>

                  {/* Permissions Checklist */}
                  <div className="rounded-xl border border-white/[0.07] bg-[#14141e] p-4">
                    <p className="text-sm font-medium text-slate-200">Hak Akses Spesifik (Permissions)</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Preset otomatis aktif sesuai role, namun Anda dapat mencentang/menonaktifkan izin khusus di bawah ini:
                    </p>

                    <div className="mt-3.5 space-y-2.5">
                      {[
                        {
                          key: "canAccessAdminPanel" as const,
                          label: "Akses Admin Dashboard",
                          desc: "Boleh login dan membuka portal admin panel.",
                        },
                        {
                          key: "canManageExtensions" as const,
                          label: "Kelola Ekstensi Komik",
                          desc: "Bisa menambah, mengedit, dan menghapus sumber komik/anime.",
                        },
                        {
                          key: "canBanUsers" as const,
                          label: "Blokir & Moderasi Pengguna",
                          desc: "Bisa melakukan ban atau unban akun pengguna lain.",
                        },
                        {
                          key: "bypassRateLimit" as const,
                          label: "Bypass Rate Limit API",
                          desc: "Bebas batasan frekuensi panggilan API eksternal.",
                        },
                        {
                          key: "canAccessNsfw" as const,
                          label: "Akses Konten Dewasa / NSFW 18+",
                          desc: "Membuka katalog konten dewasa pada ekstensi yang didukung.",
                        },
                      ].map((perm) => (
                        <label
                          key={perm.key}
                          className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 hover:bg-white/[0.04] cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={targetPermissions[perm.key]}
                            onChange={() => togglePermission(perm.key)}
                            className="mt-0.5 h-4 w-4 rounded accent-sky-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-slate-200">{perm.label}</span>
                            <span className="block text-xs text-slate-400">{perm.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={busy}
                      className="rounded-lg border border-white/[0.09] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveRoleAndPermissions()}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition"
                    >
                      <ShieldCheck size={16} weight="bold" />
                      {busy ? "Menyimpan..." : "Simpan Hak Akses"}
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 2: LIHAT KOLEKSI & RIWAYAT USER */}
              {modal === "sync" && (
                <div className="space-y-4">
                  {/* Status Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#14141e] p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-slate-300">
                      <span>
                        Pustaka: <strong className="text-sky-300">{syncData?.library.length ?? selected?.libraryCount ?? 0}</strong> komik
                      </span>
                      <span>
                        Riwayat: <strong className="text-violet-300">{syncData?.history.length ?? selected?.historyCount ?? 0}</strong> dibaca
                      </span>
                      {selected && (
                        <span className="text-slate-500 font-mono text-[11px]">
                          UID: <strong className="text-slate-400">{selected.uid}</strong>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <ClockCounterClockwise size={14} />
                      <span>
                        Terakhir sinkron:{" "}
                        <strong className="text-slate-200">
                          {formatSafeDate(syncData?.lastSyncedAt || selected?.lastSyncedAt)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Tabs & Search */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex rounded-lg border border-white/[0.08] bg-[#14141e] p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSyncTab("library")}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${
                          syncTab === "library"
                            ? "bg-sky-500 text-slate-950 font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Pustaka Bookmark ({syncData?.library.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSyncTab("history")}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${
                          syncTab === "history"
                            ? "bg-sky-500 text-slate-950 font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Riwayat Baca ({syncData?.history.length || 0})
                      </button>
                    </div>

                    <input
                      type="search"
                      value={syncSearch}
                      onChange={(e) => setSyncSearch(e.target.value)}
                      placeholder={`Cari di ${syncTab === "library" ? "pustaka" : "riwayat"}...`}
                      className="rounded-lg border border-white/[0.08] bg-[#14141e] px-3 py-1.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-sky-500 sm:w-56"
                    />
                  </div>

                  {/* Content List */}
                  {syncLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-slate-400">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                      <p className="mt-3 text-sm font-medium text-slate-300">Memuat koleksi & riwayat user...</p>
                      <p className="mt-1 text-xs text-slate-500">Mengecek sinkronisasi Firestore cloud</p>
                    </div>
                  ) : syncTab === "library" ? (
                    filteredLibrary.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center text-sm text-slate-500">
                        {syncSearch ? "Tidak ada komik yang sesuai kata kunci." : "User belum menyimpan bookmark komik."}
                      </div>
                    ) : (
                      <div className="grid max-h-[50vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                        {filteredLibrary.map((item, idx) => (
                          <div
                            key={`${item.comicId}-${idx}`}
                            className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#14141e] p-3 text-left transition hover:border-white/[0.12]"
                          >
                            {item.coverUrl ? (
                              <img
                                src={item.coverUrl}
                                alt={item.title || "Cover"}
                                className="h-16 w-12 flex-shrink-0 rounded-lg object-cover bg-slate-800"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
                                <BookOpen size={20} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white" title={item.title}>
                                {item.title || "Tanpa Judul"}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                                  {item.sourceName || "Unknown"}
                                </span>
                                {item.status && (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-[10px] text-slate-500">
                                Update: {relativeTime(item.updatedAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : filteredHistory.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center text-sm text-slate-500">
                      {syncSearch ? "Tidak ada riwayat yang sesuai kata kunci." : "User belum memiliki riwayat baca."}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {filteredHistory.map((item, idx) => (
                        <div
                          key={`${item.comicId}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#14141e] p-3 transition hover:border-white/[0.12]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {item.coverUrl ? (
                              <img
                                src={item.coverUrl}
                                alt={item.title || "Cover"}
                                className="h-12 w-10 flex-shrink-0 rounded object-cover bg-slate-800"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-12 w-10 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-slate-500">
                                <BookOpen size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white" title={item.title}>
                                {item.title || "Tanpa Judul"}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-sky-300">
                                {item.lastChapterTitle || (item.lastChapterNumber ? `Chapter ${item.lastChapterNumber}` : "Chapter -")}
                                {item.lastPage ? ` • Hal ${item.lastPage}` : ""}
                              </p>
                              <span className="text-[10px] text-slate-500">{item.sourceName || "Komik"}</span>
                            </div>
                          </div>
                          <span className="flex-shrink-0 text-right text-[11px] text-slate-400">
                            {relativeTime(item.updatedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-white/[0.09] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 3: BAN USER */}
              {modal === "ban" && (
                <div className="space-y-4">
                  <label className="block text-sm text-slate-300">
                    Pilih Alasan Pemblokiran
                    <select
                      value={banReason}
                      onChange={(event) => setBanReason(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-2.5 text-sm outline-none focus:border-amber-400 transition"
                    >
                      <option value="">Pilih alasan umum...</option>
                      <option value="Spamming API & Abusing Resources">Spamming API & Abusing Resources</option>
                      <option value="Pelanggaran Ketentuan Layanan">Pelanggaran Ketentuan Layanan</option>
                      <option value="Aktivitas Scraping Ilegal">Aktivitas Scraping Ilegal</option>
                      <option value="Penggunaan Akun Berganda / Bot">Penggunaan Akun Berganda / Bot</option>
                    </select>
                  </label>

                  <label className="block text-sm text-slate-300">
                    Alasan Kustom / Tambahan
                    <input
                      value={customReason}
                      onChange={(event) => setCustomReason(event.target.value)}
                      placeholder="Tulis alasan spesifik jika tidak ada di pilihan di atas"
                      className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-amber-400 transition"
                    />
                  </label>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={busy}
                      className="rounded-lg border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void banUser()}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50 transition"
                    >
                      <UserMinus size={16} weight="bold" />
                      {busy ? "Memproses..." : "Konfirmasi Blokir Akun"}
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 4: DETAIL ALASAN BANNED */}
              {modal === "reason" && (
                <div>
                  <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4">
                    <div className="flex items-center gap-2 text-rose-300">
                      <ShieldWarning size={20} weight="duotone" />
                      <p className="text-sm font-semibold">Status: Akun Sedang Diblokir</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{selected.banReason || "Tidak ada alasan tercatat."}</p>
                    {parseDate(selected.bannedAt) && (
                      <p className="mt-3 text-xs text-slate-500">
                        Diblokir pada: {parseDate(selected.bannedAt)?.toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void unbanUser(selected)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
                    >
                      <UserPlus size={16} weight="bold" />
                      Pulihkan Akun Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg border border-white/[0.09] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {/* MODAL 5: DELETE USER */}
              {modal === "delete" && (
                <div>
                  <p className="text-sm leading-6 text-slate-300">
                    Tindakan ini akan menghapus dokumen profil pengguna dari koleksi <code className="text-rose-300">USERS/{selected.id}</code> secara permanen.
                  </p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={busy}
                      className="rounded-lg border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteUser()}
                      disabled={busy}
                      className="rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50 transition"
                    >
                      {busy ? "Menghapus..." : "Hapus Permanen"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
