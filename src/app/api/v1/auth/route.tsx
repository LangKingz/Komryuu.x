import { NextResponse } from "next/server";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";

export const dynamic = "force-dynamic";

export interface UserPermissions {
  canAccessAdminPanel: boolean;
  canManageExtensions: boolean;
  canBanUsers: boolean;
  bypassRateLimit: boolean;
  canAccessNsfw: boolean;
}

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  canAccessAdminPanel: false,
  canManageExtensions: false,
  canBanUsers: false,
  bypassRateLimit: false,
  canAccessNsfw: false,
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | null {
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

function normalizePermissions(
  role: string,
  rawPermissions: unknown
): UserPermissions {
  const fallback = ROLE_DEFAULT_PERMISSIONS[role] || DEFAULT_USER_PERMISSIONS;
  if (!isRecord(rawPermissions)) {
    return fallback;
  }

  return {
    canAccessAdminPanel:
      typeof rawPermissions.canAccessAdminPanel === "boolean"
        ? rawPermissions.canAccessAdminPanel
        : fallback.canAccessAdminPanel,
    canManageExtensions:
      typeof rawPermissions.canManageExtensions === "boolean"
        ? rawPermissions.canManageExtensions
        : fallback.canManageExtensions,
    canBanUsers:
      typeof rawPermissions.canBanUsers === "boolean"
        ? rawPermissions.canBanUsers
        : fallback.canBanUsers,
    bypassRateLimit:
      typeof rawPermissions.bypassRateLimit === "boolean"
        ? rawPermissions.bypassRateLimit
        : fallback.bypassRateLimit,
    canAccessNsfw:
      typeof rawPermissions.canAccessNsfw === "boolean"
        ? rawPermissions.canAccessNsfw
        : fallback.canAccessNsfw,
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
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!uid) {
    return NextResponse.json(
      { success: false, error: "uid is required" },
      { status: 400 }
    );
  }
  if (!email) {
    return NextResponse.json(
      { success: false, error: "email is required" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json(
      { success: false, error: "name is required" },
      { status: 400 }
    );
  }

  if (body.photoUrl !== undefined && typeof body.photoUrl !== "string") {
    return NextResponse.json(
      { success: false, error: "photoUrl must be a string" },
      { status: 400 }
    );
  }
  if (body.provider !== undefined && typeof body.provider !== "string") {
    return NextResponse.json(
      { success: false, error: "provider must be a string" },
      { status: 400 }
    );
  }

  let deviceInfo: Record<string, string> = {};
  if (body.deviceInfo !== undefined) {
    if (!isRecord(body.deviceInfo)) {
      return NextResponse.json(
        { success: false, error: "deviceInfo must be an object" },
        { status: 400 }
      );
    }
    for (const field of ["platform", "appVersion", "deviceModel"] as const) {
      if (
        body.deviceInfo[field] !== undefined &&
        typeof body.deviceInfo[field] !== "string"
      ) {
        return NextResponse.json(
          { success: false, error: `deviceInfo.${field} must be a string` },
          { status: 400 }
        );
      }
      if (typeof body.deviceInfo[field] === "string") {
        deviceInfo[field] = body.deviceInfo[field];
      }
    }
  }

  const photoUrl =
    typeof body.photoUrl === "string" ? body.photoUrl.trim() : "";
  const provider =
    typeof body.provider === "string" && body.provider.trim()
      ? body.provider.trim()
      : "google";

  try {
    const userReference = doc(db, "USERS", uid);
    const existing = await getDoc(userReference);

    if (!existing.exists()) {
      await setDoc(userReference, {
        uid,
        email,
        name,
        photoUrl,
        provider,
        deviceInfo,
        role: "user",
        permissions: DEFAULT_USER_PERMISSIONS,
        isBanned: false,
        banReason: "",
        bannedAt: null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userReference, {
        name,
        photoUrl,
        deviceInfo,
        lastLoginAt: serverTimestamp(),
      });
    }

    const saved = await getDoc(userReference);
    const rawData = saved.exists() ? (saved.data() as Record<string, unknown>) : {};

    let rawRole = typeof rawData.role === "string" ? rawData.role.toLowerCase() : "user";
    let vipExpiresAt: string | null = null;
    if (rawData.vipExpiresAt) {
      const parsedDate = parseDate(rawData.vipExpiresAt);
      if (parsedDate) {
        vipExpiresAt = parsedDate.toISOString();
      }
    }

    // Periksa jika role === "vip" dan vipExpiresAt sudah melewati waktu sekarang
    if (rawRole === "vip" && vipExpiresAt) {
      const expiresDate = new Date(vipExpiresAt);
      if (new Date() > expiresDate) {
        // Otomatis turunkan role menjadi user dan hapus vipExpiresAt di Firestore
        await updateDoc(userReference, {
          role: "user",
          vipExpiresAt: null,
          permissions: ROLE_DEFAULT_PERMISSIONS.user,
          updatedAt: serverTimestamp(),
        });
        rawRole = "user";
        vipExpiresAt = null;
      }
    }

    const role =
      rawRole === "admin" || rawRole === "moderator" || rawRole === "vip"
        ? rawRole
        : "user";
    const permissions = normalizePermissions(role, rawData.permissions);

    const userData = {
      uid,
      email: typeof rawData.email === "string" ? rawData.email : email,
      name: typeof rawData.name === "string" ? rawData.name : name,
      photoUrl: typeof rawData.photoUrl === "string" ? rawData.photoUrl : photoUrl,
      provider: typeof rawData.provider === "string" ? rawData.provider : provider,
      deviceInfo: isRecord(rawData.deviceInfo) ? rawData.deviceInfo : deviceInfo,
      role,
      vipExpiresAt: role === "vip" ? vipExpiresAt : null,
      permissions,
      isBanned: rawData.isBanned === true,
      banReason: typeof rawData.banReason === "string" ? rawData.banReason : "",
      bannedAt: rawData.bannedAt ?? null,
      createdAt: rawData.createdAt ?? null,
      lastLoginAt: rawData.lastLoginAt ?? null,
      ...(typeof rawData.libraryCount === "number" ? { libraryCount: rawData.libraryCount } : {}),
      ...(typeof rawData.historyCount === "number" ? { historyCount: rawData.historyCount } : {}),
      ...(rawData.lastSyncedAt ? { lastSyncedAt: rawData.lastSyncedAt } : {}),
    };

    if (userData.isBanned === true) {
      return NextResponse.json(
        {
          success: false,
          code: "USER_BANNED",
          message: "Akun Anda telah diblokir",
          banReason: userData.banReason,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, user: userData }, { status: 200 });
  } catch (error) {
    console.error("Auth user upsert failed", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}
