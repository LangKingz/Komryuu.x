import { NextResponse } from "next/server";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";

export const dynamic = "force-dynamic";

export interface ComicBookmark {
  comicId: string;
  title: string;
  coverUrl: string;
  sourceName: string;
  status: string;
  updatedAt: string | number;
  [key: string]: unknown;
}

export interface ReadingHistory {
  comicId: string;
  title: string;
  coverUrl: string;
  sourceName: string;
  lastChapterNumber: string | number;
  lastChapterTitle: string;
  lastPage: number;
  updatedAt: string | number;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTimestamp(val: unknown): number {
  if (typeof val === "number") {
    return isNaN(val) ? 0 : val;
  }
  if (typeof val === "string") {
    const num = Number(val);
    if (!isNaN(num) && num > 0) return num;
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof val === "object" && val !== null && "seconds" in val) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function sanitizeLibraryItem(item: unknown): ComicBookmark | null {
  if (!isRecord(item)) return null;

  const title = (
    typeof item.title === "string" ? item.title :
    typeof item.judul === "string" ? item.judul :
    typeof item.comicTitle === "string" ? item.comicTitle :
    typeof item.name === "string" ? item.name :
    typeof item.nama === "string" ? item.nama :
    typeof item.judulKomik === "string" ? item.judulKomik :
    "Tanpa Judul"
  ).trim();

  let comicId = (
    typeof item.comicId === "string" ? item.comicId :
    typeof item.comic_id === "string" ? item.comic_id :
    typeof item.id === "string" ? item.id :
    typeof item.link === "string" ? item.link :
    typeof item.url === "string" ? item.url :
    typeof item.comicUrl === "string" ? item.comicUrl :
    typeof item.comic_url === "string" ? item.comic_url :
    typeof item.komikId === "string" ? item.komikId :
    typeof item.mangaId === "string" ? item.mangaId :
    typeof item.slug === "string" ? item.slug : ""
  ).trim();

  if (!comicId && title && title !== "Tanpa Judul") {
    comicId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  if (!comicId) return null;

  const coverUrl = (
    typeof item.coverUrl === "string" ? item.coverUrl :
    typeof item.cover_url === "string" ? item.cover_url :
    typeof item.cover === "string" ? item.cover :
    typeof item.gambar === "string" ? item.gambar :
    typeof item.thumbnail === "string" ? item.thumbnail :
    typeof item.thumb === "string" ? item.thumb :
    typeof item.image === "string" ? item.image :
    typeof item.img === "string" ? item.img :
    typeof item.foto === "string" ? item.foto : ""
  ).trim();

  const sourceName = (
    typeof item.sourceName === "string" ? item.sourceName :
    typeof item.source_name === "string" ? item.source_name :
    typeof item.source === "string" ? item.source :
    typeof item.sumber === "string" ? item.sumber :
    typeof item.extensionName === "string" ? item.extensionName :
    typeof item.ext === "string" ? item.ext :
    "Komik"
  ).trim();

  const status = (
    typeof item.status === "string" ? item.status :
    typeof item.state === "string" ? item.state : ""
  ).trim();

  const updatedAt =
    item.updatedAt !== undefined ? item.updatedAt :
    item.updated_at !== undefined ? item.updated_at :
    item.timestamp !== undefined ? item.timestamp :
    item.waktu !== undefined ? item.waktu :
    Date.now();

  return {
    ...item,
    comicId,
    title,
    coverUrl,
    sourceName,
    status,
    updatedAt: typeof updatedAt === "number" || typeof updatedAt === "string" ? updatedAt : Date.now(),
  };
}

function sanitizeHistoryItem(item: unknown): ReadingHistory | null {
  if (!isRecord(item)) return null;

  const title = (
    typeof item.title === "string" ? item.title :
    typeof item.judul === "string" ? item.judul :
    typeof item.comicTitle === "string" ? item.comicTitle :
    typeof item.name === "string" ? item.name :
    typeof item.nama === "string" ? item.nama :
    typeof item.judulKomik === "string" ? item.judulKomik :
    "Tanpa Judul"
  ).trim();

  let comicId = (
    typeof item.comicId === "string" ? item.comicId :
    typeof item.comic_id === "string" ? item.comic_id :
    typeof item.id === "string" ? item.id :
    typeof item.link === "string" ? item.link :
    typeof item.url === "string" ? item.url :
    typeof item.comicUrl === "string" ? item.comicUrl :
    typeof item.comic_url === "string" ? item.comic_url :
    typeof item.komikId === "string" ? item.komikId :
    typeof item.mangaId === "string" ? item.mangaId :
    typeof item.slug === "string" ? item.slug : ""
  ).trim();

  if (!comicId && title && title !== "Tanpa Judul") {
    comicId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  if (!comicId) return null;

  const coverUrl = (
    typeof item.coverUrl === "string" ? item.coverUrl :
    typeof item.cover_url === "string" ? item.cover_url :
    typeof item.cover === "string" ? item.cover :
    typeof item.gambar === "string" ? item.gambar :
    typeof item.thumbnail === "string" ? item.thumbnail :
    typeof item.thumb === "string" ? item.thumb :
    typeof item.image === "string" ? item.image :
    typeof item.img === "string" ? item.img :
    typeof item.foto === "string" ? item.foto : ""
  ).trim();

  const sourceName = (
    typeof item.sourceName === "string" ? item.sourceName :
    typeof item.source_name === "string" ? item.source_name :
    typeof item.source === "string" ? item.source :
    typeof item.sumber === "string" ? item.sumber :
    typeof item.extensionName === "string" ? item.extensionName :
    typeof item.ext === "string" ? item.ext :
    "Komik"
  ).trim();

  const lastChapterNumber =
    item.lastChapterNumber !== undefined ? item.lastChapterNumber :
    item.last_chapter_number !== undefined ? item.last_chapter_number :
    item.chapter !== undefined ? item.chapter :
    item.lastChapter !== undefined ? item.lastChapter :
    item.last_chapter !== undefined ? item.last_chapter :
    item.chapterNumber !== undefined ? item.chapterNumber :
    item.bab !== undefined ? item.bab :
    item.nomorBab !== undefined ? item.nomorBab :
    "-";

  const lastChapterTitle = (
    typeof item.lastChapterTitle === "string" ? item.lastChapterTitle :
    typeof item.last_chapter_title === "string" ? item.last_chapter_title :
    typeof item.chapterTitle === "string" ? item.chapterTitle :
    typeof item.judulChapter === "string" ? item.judulChapter :
    typeof item.judul_bab === "string" ? item.judul_bab :
    typeof item.chapterName === "string" ? item.chapterName : ""
  ).trim();

  const lastPage =
    typeof item.lastPage === "number" ? item.lastPage :
    typeof item.last_page === "number" ? item.last_page :
    typeof item.page === "number" ? item.page :
    typeof item.halaman === "number" ? item.halaman :
    1;

  const updatedAt =
    item.updatedAt !== undefined ? item.updatedAt :
    item.updated_at !== undefined ? item.updated_at :
    item.timestamp !== undefined ? item.timestamp :
    item.waktu !== undefined ? item.waktu :
    Date.now();

  return {
    ...item,
    comicId,
    title,
    coverUrl,
    sourceName,
    lastChapterNumber: typeof lastChapterNumber === "string" || typeof lastChapterNumber === "number" ? lastChapterNumber : "-",
    lastChapterTitle,
    lastPage,
    updatedAt: typeof updatedAt === "number" || typeof updatedAt === "string" ? updatedAt : Date.now(),
  };
}

function mergeLibrary(
  existing: ComicBookmark[],
  incoming: ComicBookmark[]
): ComicBookmark[] {
  const map = new Map<string, ComicBookmark>();

  for (const item of existing) {
    if (item && typeof item.comicId === "string" && item.comicId.trim()) {
      map.set(item.comicId.trim(), item);
    }
  }

  for (const item of incoming) {
    if (!item || typeof item.comicId !== "string" || !item.comicId.trim()) {
      continue;
    }
    const key = item.comicId.trim();
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
    } else {
      const currentTs = parseTimestamp(current.updatedAt);
      const incomingTs = parseTimestamp(item.updatedAt);
      if (incomingTs >= currentTs) {
        map.set(key, { ...current, ...item });
      }
    }
  }

  return Array.from(map.values());
}

function mergeHistory(
  existing: ReadingHistory[],
  incoming: ReadingHistory[]
): ReadingHistory[] {
  const map = new Map<string, ReadingHistory>();

  for (const item of existing) {
    if (item && typeof item.comicId === "string" && item.comicId.trim()) {
      map.set(item.comicId.trim(), item);
    }
  }

  for (const item of incoming) {
    if (!item || typeof item.comicId !== "string" || !item.comicId.trim()) {
      continue;
    }
    const key = item.comicId.trim();
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
    } else {
      const currentTs = parseTimestamp(current.updatedAt);
      const incomingTs = parseTimestamp(item.updatedAt);
      if (incomingTs >= currentTs) {
        map.set(key, { ...current, ...item });
      }
    }
  }

  return Array.from(map.values());
}

export async function POST(request: Request) {
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { success: false, error: "Request body must be an object" },
      { status: 400 }
    );
  }

  // 1. Ekstrak UID secara fleksibel
  const uid = (
    typeof body.uid === "string" ? body.uid :
    typeof body.userId === "string" ? body.userId :
    typeof body.user_id === "string" ? body.user_id :
    typeof body.id === "string" ? body.id : ""
  ).trim();

  if (!uid) {
    return NextResponse.json(
      { success: false, error: "uid is required" },
      { status: 400 }
    );
  }

  // 2. Terima library/pustaka/bookmarks secara fleksibel
  const rawLibrary =
    Array.isArray(body.library) ? body.library :
    Array.isArray(body.pustaka) ? body.pustaka :
    Array.isArray(body.bookmarks) ? body.bookmarks :
    Array.isArray(body.bookmark) ? body.bookmark :
    Array.isArray(body.koleksi) ? body.koleksi :
    [];

  // 3. Terima history/riwayat secara fleksibel
  const rawHistory =
    Array.isArray(body.history) ? body.history :
    Array.isArray(body.riwayat) ? body.riwayat :
    Array.isArray(body.readingHistory) ? body.readingHistory :
    Array.isArray(body.baca) ? body.baca :
    [];

  const incomingLibrary: ComicBookmark[] = rawLibrary
    .map(sanitizeLibraryItem)
    .filter(Boolean) as ComicBookmark[];

  const incomingHistory: ReadingHistory[] = rawHistory
    .map(sanitizeHistoryItem)
    .filter(Boolean) as ReadingHistory[];

  try {
    const userRef = doc(db, "USERS", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData?.isBanned === true) {
        return NextResponse.json(
          {
            success: false,
            code: "USER_BANNED",
            message: "Akun Anda telah diblokir",
            banReason: typeof userData.banReason === "string" ? userData.banReason : "",
          },
          { status: 403 }
        );
      }
    }

    // Ambil data yang sudah ada di sub-collection sync_data/backup
    const backupRef = doc(db, "USERS", uid, "sync_data", "backup");
    const existingBackupSnap = await getDoc(backupRef);
    const existingBackupData = existingBackupSnap.exists() ? existingBackupSnap.data() : null;

    // Fallback: cek dokumen USERS/{uid} jika sub-collection belum pernah dibuat
    const existingUserData = userSnap.exists() ? userSnap.data() : null;

    const existingLibrarySource =
      existingBackupData && Array.isArray(existingBackupData.library)
        ? existingBackupData.library
        : existingUserData && Array.isArray(existingUserData.library)
        ? existingUserData.library
        : existingUserData && Array.isArray(existingUserData.pustaka)
        ? existingUserData.pustaka
        : [];

    const existingHistorySource =
      existingBackupData && Array.isArray(existingBackupData.history)
        ? existingBackupData.history
        : existingUserData && Array.isArray(existingUserData.history)
        ? existingUserData.history
        : existingUserData && Array.isArray(existingUserData.riwayat)
        ? existingUserData.riwayat
        : [];

    const existingLibrary: ComicBookmark[] = existingLibrarySource
      .map(sanitizeLibraryItem)
      .filter(Boolean) as ComicBookmark[];

    const existingHistory: ReadingHistory[] = existingHistorySource
      .map(sanitizeHistoryItem)
      .filter(Boolean) as ReadingHistory[];

    // Merge data baru dengan data lama berbasis timestamp
    const mergedLibrary = mergeLibrary(existingLibrary, incomingLibrary);
    const mergedHistory = mergeHistory(existingHistory, incomingHistory);
    const lastSyncedAt = new Date().toISOString();

    // Simpan eksplisit ke sub-collection USERS/{uid}/sync_data/backup
    await setDoc(
      backupRef,
      {
        uid,
        library: mergedLibrary,
        history: mergedHistory,
        syncedLibraryCount: mergedLibrary.length,
        syncedHistoryCount: mergedHistory.length,
        lastSyncedAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Simpan juga ringkasan & data langsung ke dokumen induk USERS/{uid}
    await setDoc(
      userRef,
      {
        uid,
        lastSyncedAt,
        libraryCount: mergedLibrary.length,
        historyCount: mergedHistory.length,
        library: mergedLibrary,
        history: mergedHistory,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Logging terminal untuk mempermudah debugging
    console.log(
      `[Cloud Sync POST] uid=${uid} | Diterima: Library=${rawLibrary.length}, History=${rawHistory.length} | Disimpan (Merged): Library=${mergedLibrary.length}, History=${mergedHistory.length} => USERS/${uid}/sync_data/backup & USERS/${uid}`
    );

    return NextResponse.json(
      {
        success: true,
        syncedLibraryCount: mergedLibrary.length,
        syncedHistoryCount: mergedHistory.length,
        lastSyncedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Cloud Sync POST Error] uid=${uid}:`, error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

export async function GET(request: Request) {
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid")?.trim() || searchParams.get("userId")?.trim();

  if (!uid) {
    return NextResponse.json(
      { success: false, error: "uid query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const userRef = doc(db, "USERS", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData?.isBanned === true) {
        return NextResponse.json(
          {
            success: false,
            code: "USER_BANNED",
            message: "Akun Anda telah diblokir",
            banReason: typeof userData.banReason === "string" ? userData.banReason : "",
          },
          { status: 403 }
        );
      }
    }

    // 1. Coba baca dari sub-collection USERS/{uid}/sync_data/backup
    const backupRef = doc(db, "USERS", uid, "sync_data", "backup");
    const backupSnap = await getDoc(backupRef);

    let rawLibrary: unknown[] = [];
    let rawHistory: unknown[] = [];
    let lastSyncedAt: string | null = null;

    if (backupSnap.exists()) {
      const backupData = backupSnap.data() || {};
      rawLibrary = Array.isArray(backupData.library)
        ? backupData.library
        : Array.isArray(backupData.pustaka)
        ? backupData.pustaka
        : [];
      rawHistory = Array.isArray(backupData.history)
        ? backupData.history
        : Array.isArray(backupData.riwayat)
        ? backupData.riwayat
        : [];
      lastSyncedAt = typeof backupData.lastSyncedAt === "string" ? backupData.lastSyncedAt : null;
    }

    // 2. Fallback jika sub-collection kosong: baca dari dokumen induk USERS/{uid}
    if (rawLibrary.length === 0 && rawHistory.length === 0 && userSnap.exists()) {
      const userData = userSnap.data() || {};
      rawLibrary = Array.isArray(userData.library)
        ? userData.library
        : Array.isArray(userData.pustaka)
        ? userData.pustaka
        : Array.isArray(userData.bookmarks)
        ? userData.bookmarks
        : [];
      rawHistory = Array.isArray(userData.history)
        ? userData.history
        : Array.isArray(userData.riwayat)
        ? userData.riwayat
        : [];
      if (!lastSyncedAt && typeof userData.lastSyncedAt === "string") {
        lastSyncedAt = userData.lastSyncedAt;
      }
    }

    const cleanLibrary = rawLibrary.map(sanitizeLibraryItem).filter(Boolean);
    const cleanHistory = rawHistory.map(sanitizeHistoryItem).filter(Boolean);

    console.log(
      `[Cloud Sync GET] uid=${uid} => Dikembalikan: Library=${cleanLibrary.length}, History=${cleanHistory.length}, lastSyncedAt=${lastSyncedAt}`
    );

    return NextResponse.json({
      success: true,
      uid,
      library: cleanLibrary,
      history: cleanHistory,
      lastSyncedAt,
    });
  } catch (error) {
    console.error(`[Cloud Sync GET Error] uid=${uid}:`, error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}
