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
  email: string;
  name: string;
  status: string;
  createdAt?: string;
};

function toUserProfile(data: Record<string, unknown>): UserProfile {
  return {
    id: typeof data.id === "string" ? data.id : "",
    email: typeof data.email === "string" ? data.email : "",
    name: typeof data.name === "string" ? data.name : "",
    status: typeof data.status === "string" ? data.status : "active",
    ...(typeof data.createdAt === "string" ? { createdAt: data.createdAt } : {}),
  };
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
      const document = await getFirestoreDocument(`users/${id}`);
      if (!document) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: toUserProfile(document),
        ...externalApiMetadata(authorization.settings),
      });
    }

    const documents = email
      ? await queryFirestoreDocuments("users", "email", email, limit)
      : await listFirestoreDocuments("users", limit);
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
    if ((await queryFirestoreDocuments("users", "email", email, 1)).length > 0) {
      return NextResponse.json({ success: false, error: "Email is already registered" }, { status: 409 });
    }

    const id = randomUUID().replace(/-/g, "");
    const credentials = hashPassword(password);
    const createdAt = new Date().toISOString();
    const newUser = {
      email,
      name,
      status: "active",
      ...credentials,
      createdAt,
    };
    await createFirestoreDocument("users", id, newUser);

    return NextResponse.json({
      success: true,
      data: { id, email, name, status: "active", createdAt },
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
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "At least one editable field is required" }, { status: 400 });
    }

    const current = await getFirestoreDocument(`users/${id}`);
    if (!current) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    if (typeof updates.email === "string") {
      const duplicate = await queryFirestoreDocuments("users", "email", updates.email, 1);
      if (duplicate.some((user) => user.id !== id)) {
        return NextResponse.json({ success: false, error: "Email is already registered" }, { status: 409 });
      }
    }

    await updateFirestoreDocument("users", id, updates);
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
    const current = await getFirestoreDocument(`users/${id}`);
    if (!current) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    await deleteFirestoreDocument("users", id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return failureResponse(error, "delete user");
  }
}
