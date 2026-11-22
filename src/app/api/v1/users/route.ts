import { randomBytes, randomUUID, scryptSync } from "crypto";
import { NextResponse } from "next/server";
import { authorizeAdminApiRequest, isRecord } from "@/lib/admin-api";
import {
  authorizeExternalApiRequest,
  externalApiMetadata,
} from "@/lib/external-api";
import {
  createFirestoreDocument,
  deleteFirestoreDocument,
  FirestoreRestError,
  getFirestoreDocument,
  listFirestoreDocuments,
  queryFirestoreDocuments,
  updateFirestoreDocument,
} from "@/lib/firestore-rest";

type UserProfile = {
  id: string;
  uid?: string;
  email: string;
  name: string;
  photoUrl?: string;
  provider?: string;
  role?: string;
  vipExpiresAt?: string | null;
  vipDaysLeft?: number | null;
  permissions?: unknown;
  status: string;
  isBanned?: boolean;
  banReason?: string;
  deviceInfo?: unknown;
  libraryCount: number;
  historyCount: number;
  lastSyncedAt?: string | null;
  library?: unknown[];
  history?: unknown[];
  createdAt?: string;
  lastLoginAt?: string;
};

function toUserProfile(data: Record<string, unknown>): UserProfile {
  const rawLib = data.library || data.pustaka || data.bookmarks || data.bookmark || data.koleksi;
  const rawHist = data.history || data.riwayat || data.readingHistory || data.baca;
  const library = Array.isArray(rawLib) ? rawLib : [];
  const history = Array.isArray(rawHist) ? rawHist : [];

  const libraryCount =
    typeof data.libraryCount === "number"
      ? data.libraryCount
      : library.length;

  const historyCount =
    typeof data.historyCount === "number"
      ? data.historyCount
      : history.length;

  const isBanned = data.isBanned === true;
  const status = isBanned ? "banned" : typeof data.status === "string" ? data.status : "active";

  let vipExpiresAt: string | null = null;
  let vipDaysLeft: number | null = null;
  if (data.vipExpiresAt) {
    if (typeof data.vipExpiresAt === "string") {
      vipExpiresAt = data.vipExpiresAt;
    } else if (data.vipExpiresAt instanceof Date) {
      vipExpiresAt = data.vipExpiresAt.toISOString();
    } else if (typeof data.vipExpiresAt === "object" && data.vipExpiresAt !== null && "toDate" in data.vipExpiresAt) {
      const toDate = (data.vipExpiresAt as { toDate?: unknown }).toDate;
      if (typeof toDate === "function") {
        const d = toDate.call(data.vipExpiresAt);
        if (d instanceof Date) vipExpiresAt = d.toISOString();
      }
    }
    if (vipExpiresAt) {
      const expDate = new Date(vipExpiresAt);
      if (!isNaN(expDate.getTime())) {
        vipDaysLeft = Math.max(0, Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      }
    }
  }

  return {
    id: typeof data.id === "string" ? data.id : typeof data.uid === "string" ? data.uid : "",
    uid: typeof data.uid === "string" ? data.uid : typeof data.id === "string" ? data.id : "",
    email: typeof data.email === "string" ? data.email : "",
    name: typeof data.name === "string" ? data.name : "",
    ...(typeof data.photoUrl === "string" ? { photoUrl: data.photoUrl } : {}),
    ...(typeof data.provider === "string" ? { provider: data.provider } : {}),
    role: typeof data.role === "string" ? data.role : "user",
    vipExpiresAt,
    vipDaysLeft,
    ...(data.permissions ? { permissions: data.permissions } : {}),
    status,
    isBanned,
    ...(typeof data.banReason === "string" ? { banReason: data.banReason } : {}),
    ...(data.deviceInfo ? { deviceInfo: data.deviceInfo } : {}),
    libraryCount,
    historyCount,
    lastSyncedAt: typeof data.lastSyncedAt === "string" ? data.lastSyncedAt : null,
    library,
    history,
    ...(typeof data.createdAt === "string" ? { createdAt: data.createdAt } : {}),
    ...(data.lastLoginAt ? { lastLoginAt: String(data.lastLoginAt) } : {}),
  };
}

async function findUserDoc(id: string): Promise<{ doc: Record<string, unknown>; collectionName: string } | null> {
  const upper = await getFirestoreDocument(`USERS/${id}`);
  if (upper) return { doc: upper, collectionName: "USERS" };
  const lower = await getFirestoreDocument(`users/${id}`);
  if (lower) return { doc: lower, collectionName: "users" };
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 64).toString("hex");
  return { salt, passwordHash, passwordAlgorithm: "scrypt" };
}

function failureResponse(error: unknown, operation: string) {
  if (error instanceof FirestoreRestError) {
    if (error.status === 504) {
      return NextResponse.json({ success: false, error: "Firebase request timed out" }, { status: 504 });
    }
    if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 409) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
  }
  console.error(`External users API failed to ${operation}`, error);
  return NextResponse.json({ success: false, error: "Firebase service is unavailable" }, { status: 502 });
}

async function authorizeUserRequest(request: Request) {
  const result = await authorizeExternalApiRequest(request);
  if (!result.authorized) return result;
  return result;
}

export async function GET(request: Request) {
  const authorization = await authorizeUserRequest(request);
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  const email = searchParams.get("email")?.trim().toLowerCase();
  const requestedLimit = searchParams.get("limit");
  const limit = requestedLimit === null ? 100 : Number(requestedLimit);
  if (searchParams.has("id") && !id) {
    return NextResponse.json({ success: false, error: "id cannot be empty" }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ success: false, error: "limit must be an integer from 1 to 100" }, { status: 400 });
  }

  try {
    if (id) {
      const found = await findUserDoc(id);
      if (!found) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: toUserProfile(found.doc),
        ...externalApiMetadata(authorization.settings),
      });
    }

    let documents = email
      ? await queryFirestoreDocuments("USERS", "email", email, limit)
      : await listFirestoreDocuments("USERS", limit);

    if (documents.length === 0) {
      documents = email
        ? await queryFirestoreDocuments("users", "email", email, limit)
        : await listFirestoreDocuments("users", limit);
    }

    const users = documents.map(toUserProfile);
    return NextResponse.json({
      success: true,
      total: users.length,
      limit,
      data: users,
      ...externalApiMetadata(authorization.settings),
    });
  } catch (error) {
    return failureResponse(error, "retrieve users");
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeUserRequest(request);
  if (!authorization.authorized) return authorization.response;
  if (!authorization.settings.allowRegistration) {
    return NextResponse.json(
      { success: false, error: "Registrasi pengguna baru sedang ditutup" },
      { status: 403 }
    );
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: "Request body must be an object" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 });
    }
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json({ success: false, error: "name must be between 1 and 100 characters" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ success: false, error: "password must be between 8 and 128 characters" }, { status: 400 });
    }

    const existingUsers = await queryFirestoreDocuments("USERS", "email", email, 1);
    const existingLegacy = existingUsers.length === 0 ? await queryFirestoreDocuments("users", "email", email, 1) : [];
    if (existingUsers.length > 0 || existingLegacy.length > 0) {
      return NextResponse.json({ success: false, error: "Email is already registered" }, { status: 409 });
    }

    const id = randomUUID().replace(/-/g, "");
    const credentials = hashPassword(password);
    const createdAt = new Date().toISOString();
    const newUser = {
      uid: id,
      email,
      name,
      status: "active",
      role: "user",
      library: [],
      history: [],
      libraryCount: 0,
      historyCount: 0,
      lastSyncedAt: null,
      ...credentials,
      createdAt,
    };
    await createFirestoreDocument("USERS", id, newUser);

    return NextResponse.json({
      success: true,
      data: toUserProfile({ ...newUser, id }),
      ...externalApiMetadata(authorization.settings),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    return failureResponse(error, "create user");
  }
}

export async function PUT(request: Request) {
  const adminAuthorizationError = authorizeAdminApiRequest(request);
  if (adminAuthorizationError) return adminAuthorizationError;
  const authorization = await authorizeUserRequest(request);
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(request.url);
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: "Request body must be an object" }, { status: 400 });
    }
    const id = searchParams.get("id")?.trim() || (typeof body.id === "string" ? body.id.trim() : "");
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !isValidEmail(body.email.trim())) {
        return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 });
      }
      updates.email = body.email.trim().toLowerCase();
    }
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 100) {
        return NextResponse.json({ success: false, error: "name must be between 1 and 100 characters" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        return NextResponse.json({ success: false, error: "status must be active or inactive" }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
        return NextResponse.json({ success: false, error: "password must be between 8 and 128 characters" }, { status: 400 });
      }
      Object.assign(updates, hashPassword(body.password));
    }
    if (body.role !== undefined) {
      if (typeof body.role === "string") {
        const validRoles = ["admin", "moderator", "vip", "user"];
        const lowerRole = body.role.toLowerCase();
        if (validRoles.includes(lowerRole)) {
          updates.role = lowerRole;
          if (lowerRole === "vip") {
            if (body.vipExpiresAt !== undefined) {
              updates.vipExpiresAt = body.vipExpiresAt;
            } else if (body.vipDuration !== undefined) {
              if (body.vipDuration === "permanent" || body.vipDuration === "permanen" || body.vipDuration === null) {
                updates.vipExpiresAt = null;
              } else {
                const days = Number(body.vipDuration);
                if (!isNaN(days) && days > 0) {
                  updates.vipExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                }
              }
            }
          } else {
            updates.vipExpiresAt = null;
          }
        } else {
          return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
        }
      }
    }
    if (body.vipExpiresAt !== undefined && updates.vipExpiresAt === undefined) {
      updates.vipExpiresAt = body.vipExpiresAt;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "At least one editable field is required" }, { status: 400 });
    }

    const found = await findUserDoc(id);
    if (!found) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    const current = found.doc;

    if (typeof updates.email === "string") {
      const duplicateUsers = await queryFirestoreDocuments("USERS", "email", updates.email, 1);
      const duplicateLegacy = duplicateUsers.length === 0 ? await queryFirestoreDocuments("users", "email", updates.email, 1) : [];
      const duplicates = [...duplicateUsers, ...duplicateLegacy];
      if (duplicates.some((user) => user.id !== id)) {
        return NextResponse.json({ success: false, error: "Email is already registered" }, { status: 409 });
      }
    }

    await updateFirestoreDocument(found.collectionName, id, updates);
    return NextResponse.json({
      success: true,
      data: toUserProfile({ ...current, ...updates, id }),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    return failureResponse(error, "update user");
  }
}

export async function DELETE(request: Request) {
  const adminAuthorizationError = authorizeAdminApiRequest(request);
  if (adminAuthorizationError) return adminAuthorizationError;
  const authorization = await authorizeUserRequest(request);
  if (!authorization.authorized) return authorization.response;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

  try {
    const found = await findUserDoc(id);
    if (!found) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    await deleteFirestoreDocument(found.collectionName, id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return failureResponse(error, "delete user");
  }
}
