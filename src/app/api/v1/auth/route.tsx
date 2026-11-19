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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const userData = saved.exists()
      ? { ...saved.data(), uid }
      : {
          uid,
          email,
          name,
          photoUrl,
          provider,
          deviceInfo,
          role: "user",
          isBanned: false,
          banReason: "",
          bannedAt: null,
          createdAt: null,
          lastLoginAt: null,
        };

    if (userData.isBanned === true) {
      return NextResponse.json(
        {
          success: false,
          code: "USER_BANNED",
          message: "Akun Anda telah diblokir",
          banReason:
            typeof userData.banReason === "string" ? userData.banReason : "",
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
