import { NextResponse } from "next/server";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import crypto from "crypto";
import { authorizeExternalApiRequest } from "@/lib/external-api";

export type UserRecord = {
  id?: string;
  email: string;
  name?: string;
  passwordHash: string;
  salt: string;
  passwordAlgorithm?: "scrypt" | "pbkdf2-sha256";
  passwordIterations?: number;
  status?: "active" | "inactive";
  createdAt: string;
};

const SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "dev-secret";

function base64url(input: string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signToken(payload: object) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(header + "." + body)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(header + "." + body)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt?: string) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, usedSalt, 64).toString("hex");
  return { salt: usedSalt, hash: derived };
}

function verifyPassword(password: string, user: Record<string, unknown>): boolean {
  if (typeof user.salt !== "string" || typeof user.passwordHash !== "string") return false;

  let actualHash: Buffer;
  if (user.passwordAlgorithm === "pbkdf2-sha256") {
    const iterations =
      typeof user.passwordIterations === "number" &&
      Number.isInteger(user.passwordIterations) &&
      user.passwordIterations >= 100000 &&
      user.passwordIterations <= 1000000
        ? user.passwordIterations
        : 310000;
    actualHash = crypto.pbkdf2Sync(password, user.salt, iterations, 64, "sha256");
  } else {
    actualHash = Buffer.from(hashPassword(password, user.salt).hash, "hex");
  }

  const expectedHash = Buffer.from(user.passwordHash, "hex");
  return expectedHash.length === actualHash.length && crypto.timingSafeEqual(expectedHash, actualHash);
}

export async function POST(request: Request) {
  // This route handles both /register and /login via a `action` field in body
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
    const action = (body.action || "").toString().toLowerCase();

    if (action === "register") {
      if (!authorization.settings.allowRegistration) {
        return NextResponse.json({ success: false, error: "Registration is currently closed" }, { status: 403 });
      }

      const email = (body.email || "").toString().trim().toLowerCase();
      const password = (body.password || "").toString();
      const name = (body.name || "").toString().trim();

      if (!email || !password) {
        return NextResponse.json({ success: false, error: "email and password required" }, { status: 400 });
      }

      // check existing
      const userCollection = collection(db, "users");
      const q = query(userCollection, where("email", "==", email));
      const found = await getDocs(q);
      if (!found.empty) {
        return NextResponse.json({ success: false, error: "User already exists" }, { status: 409 });
      }

      const { salt, hash } = hashPassword(password);
      const newUser: Partial<UserRecord> = {
        email,
        name,
        passwordHash: hash,
        salt,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(userCollection, newUser);

      const token = signToken({ uid: docRef.id, email, iat: Date.now() });

      return NextResponse.json({ success: true, id: docRef.id, token, user: { id: docRef.id, email, name } });
    }

    if (action === "login") {
      const email = (body.email || "").toString().trim().toLowerCase();
      const password = (body.password || "").toString();

      if (!email || !password) {
        return NextResponse.json({ success: false, error: "email and password required" }, { status: 400 });
      }

      const usersCollection = collection(db, "users");
      const q = query(usersCollection, where("email", "==", email));
      const found = await getDocs(q);
      if (found.empty) {
        return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
      }

      const doc = found.docs[0];
      const data = doc.data();
      if (data.status === "inactive" || !verifyPassword(password, data)) {
        return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
      }

      const token = signToken({ uid: doc.id, email, iat: Date.now() });
      return NextResponse.json({ success: true, token, user: { id: doc.id, email, name: data.name } });
    }

    return NextResponse.json({ success: false, error: "invalid action" }, { status: 400 });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ success: false, error: e?.message || String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  // verify token via Authorization header: Bearer <token>
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!auth) return NextResponse.json({ success: false, error: "no token" }, { status: 401 });
    const parts = auth.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return NextResponse.json({ success: false, error: "invalid authorization header" }, { status: 401 });
    }
    const token = parts[1];
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "invalid token" }, { status: 401 });
    return NextResponse.json({ success: true, payload });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ success: false, error: e?.message || String(err) }, { status: 500 });
  }
}
