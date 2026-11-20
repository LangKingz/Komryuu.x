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

function sanitizeLibraryItem(item: unknown): ComicBookmark | null {
  if (!isRecord(item)) return null;
  const comicId = typeof item.comicId === "string" ? item.comicId.trim() : "";
  if (!comicId) return null;

  return {
    ...item,
    comicId,
    title: typeof item.title === "string" ? item.title.trim() : "",
    coverUrl: typeof item.coverUrl === "string" ? item.coverUrl.trim() : "",
    sourceName: typeof item.sourceName === "string" ? item.sourceName.trim() : "",
    status: typeof item.status === "string" ? item.status.trim() : "",
    updatedAt:
      typeof item.updatedAt === "number" || typeof item.updatedAt === "string"
        ? item.updatedAt
        : Date.now(),
  };
}

function sanitizeHistoryItem(item: unknown): ReadingHistory | null {
  if (!isRecord(item)) return null;
  const comicId = typeof item.comicId === "string" ? item.comicId.trim() : "";
  if (!comicId) return null;

  return {
    ...item,
    comicId,
    title: typeof item.title === "string" ? item.title.trim() : "",
    coverUrl: typeof item.coverUrl === "string" ? item.coverUrl.trim() : "",
    sourceName: typeof item.sourceName === "string" ? item.sourceName.trim() : "",
    lastChapterNumber:
      typeof item.lastChapterNumber === "string" || typeof item.lastChapterNumber === "number"
        ? item.lastChapterNumber
        : "",
    lastChapterTitle:
      typeof item.lastChapterTitle === "string" ? item.lastChapterTitle.trim() : "",
    lastPage: typeof item.lastPage === "number" ? item.lastPage : 1,
    updatedAt:
      typeof item.updatedAt === "number" || typeof item.updatedAt === "string"
        ? item.updatedAt
        : Date.now(),
  };
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

  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!uid) {
    return NextResponse.json(
      { success: false, error: "uid is required" },
      { status: 400 }
    );
  }

  if (body.library !== undefined && !Array.isArray(body.library)) {
    return NextResponse.json(
      { success: false, error: "library must be an array" },
      { status: 400 }
    );
  }

  if (body.history !== undefined && !Array.isArray(body.history)) {
    return NextResponse.json(
      { success: false, error: "history must be an array" },
      { status: 400 }
    );
  }

  const incomingLibrary: ComicBookmark[] = Array.isArray(body.library)
    ? (body.library.map(sanitizeLibraryItem).filter(Boolean) as ComicBookmark[])
    : [];

  const incomingHistory: ReadingHistory[] = Array.isArray(body.history)
    ? (body.history.map(sanitizeHistoryItem).filter(Boolean) as ReadingHistory[])
    : [];

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

    const backupRef = doc(db, "USERS", uid, "sync_data", "backup");
    const existingBackupSnap = await getDoc(backupRef);
    const existingData = existingBackupSnap.exists() ? existingBackupSnap.data() : null;

    const existingLibrary: ComicBookmark[] =
      existingData && Array.isArray(existingData.library)
        ? (existingData.library.map(sanitizeLibraryItem).filter(Boolean) as ComicBookmark[])
        : [];

    const existingHistory: ReadingHistory[] =
      existingData && Array.isArray(existingData.history)
        ? (existingData.history.map(sanitizeHistoryItem).filter(Boolean) as ReadingHistory[])
        : [];

    const mergedLibrary = mergeLibrary(existingLibrary, incomingLibrary);
    const mergedHistory = mergeHistory(existingHistory, incomingHistory);
    const lastSyncedAt = new Date().toISOString();

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

    await setDoc(
      userRef,
      {
        lastSyncedAt,
        libraryCount: mergedLibrary.length,
        historyCount: mergedHistory.length,
      },
      { merge: true }
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
    console.error("Sync backup failed", error);
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
  const uid = searchParams.get("uid")?.trim();

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

    const backupRef = doc(db, "USERS", uid, "sync_data", "backup");
    const backupSnap = await getDoc(backupRef);

    if (!backupSnap.exists()) {
      return NextResponse.json({
        success: true,
        uid,
        library: [],
        history: [],
        lastSyncedAt: null,
      });
    }

    const backupData = backupSnap.data() || {};

    return NextResponse.json({
      success: true,
      uid,
      library: Array.isArray(backupData.library) ? backupData.library : [],
      history: Array.isArray(backupData.history) ? backupData.history : [],
      lastSyncedAt: backupData.lastSyncedAt || null,
    });
  } catch (error) {
    console.error("Sync restore failed", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}
