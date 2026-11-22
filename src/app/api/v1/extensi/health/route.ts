import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { getCurrentAppSettings } from "@/lib/external-api";

export const dynamic = "force-dynamic";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

// Validasi otorisasi: Sesi Admin / API Key Admin / External API Key
async function isAuthorized(request: Request): Promise<boolean> {
  // 1. Cek Admin Session Cookie
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("komryuu_session")?.value;
    const roleCookie = cookieStore.get("komryuu_role")?.value;
    if (sessionCookie && (roleCookie === "admin" || roleCookie === "moderator")) {
      return true;
    }
  } catch {
    // ignore
  }

  // 2. Cek x-admin-api-key header
  const adminApiKey = process.env.ADMIN_API_KEY;
  const providedAdminKey = request.headers.get("x-admin-api-key");
  if (adminApiKey && providedAdminKey) {
    const expected = Buffer.from(adminApiKey);
    const provided = Buffer.from(providedAdminKey);
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
      return true;
    }
  }

  // 3. Cek x-api-key eksternal
  const providedExternalKey = request.headers.get("x-api-key");
  if (providedExternalKey) {
    try {
      const settings = await getCurrentAppSettings();
      if (settings.externalApiKeyHash) {
        const { createHash } = await import("crypto");
        const actualHash = createHash("sha256").update(providedExternalKey).digest();
        const expectedHash = Buffer.from(settings.externalApiKeyHash, "hex");
        if (expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  // Izinkan request jika sesi browser admin aktif (misal dari frontend dashboard)
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/dashboard") || referer.includes("/admin")) {
    return true;
  }

  return false;
}

export async function POST(request: Request) {
  const authorized = await isAuthorized(request);
  if (!authorized) {
    return NextResponse.json(
      { success: false, ok: false, error: "Akses tidak diizinkan. Memerlukan sesi admin atau API key." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json(
      { success: false, ok: false, error: "url is required and must be a string" },
      { status: 400 }
    );
  }

  const targetUrl = body.url.trim();

  // Validasi URL
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ success: false, ok: false, error: "Invalid protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, ok: false, error: "Malformed URL" }, { status: 400 });
  }

  // Siapkan header fetch kustom
  const requestHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
  };

  if (isRecord(body.customHeaders)) {
    for (const [key, val] of Object.entries(body.customHeaders)) {
      if (typeof val === "string" && val.trim()) {
        const lower = key.toLowerCase();
        if (lower === "referer") requestHeaders["Referer"] = val.trim();
        else if (lower === "useragent" || lower === "user-agent") requestHeaders["User-Agent"] = val.trim();
        else if (lower === "cookie") requestHeaders["Cookie"] = val.trim();
        else requestHeaders[key] = val.trim();
      }
    }
  }

  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // 1. Coba fetch dengan HEAD terlebih dahulu
    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: "HEAD",
        headers: requestHeaders,
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
      });
    } catch (headErr) {
      // Jika HEAD ditolak (misal Method Not Allowed), coba GET
      response = await fetch(targetUrl, {
        method: "GET",
        headers: requestHeaders,
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
      });
    }

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    const statusCode = response.status;
    const isOk = statusCode >= 200 && statusCode < 400;

    return NextResponse.json({
      success: true,
      ok: isOk,
      status: statusCode,
      latencyMs,
      url: targetUrl,
      statusText: response.statusText,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout =
      (error instanceof Error && error.name === "AbortError") || latencyMs >= 8000;

    return NextResponse.json({
      success: true,
      ok: false,
      status: isTimeout ? 504 : 502,
      latencyMs,
      url: targetUrl,
      error: isTimeout ? "Timeout (>8000ms)" : error instanceof Error ? error.message : "Connection failed",
    });
  }
}
