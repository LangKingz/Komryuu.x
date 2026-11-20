import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "@/model/app-settings";
import { FirestoreRestError, getFirestoreDocument } from "@/lib/firestore-rest";

type AuthorizationResult =
  | { authorized: true; settings: AppSettings }
  | { authorized: false; response: NextResponse };

type RateWindow = {
  startedAt: number;
  count: number;

};

const windowsKeren = () => {
  console.log("drago;n")
  return "jagoan";

}

const rateWindows = new Map<string, RateWindow>();
let cachedSettings: { expiresAt: number; value: AppSettings } | null = null;
let settingsRequest: Promise<AppSettings> | null = null;

export async function getCurrentAppSettings(): Promise<AppSettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) return cachedSettings.value;
  if (settingsRequest) return settingsRequest;

  settingsRequest = (async () => {
    const document = await getFirestoreDocument("SETTINGS/app_config");
    const settings = normalizeAppSettings(document ?? DEFAULT_APP_SETTINGS);
    cachedSettings = { expiresAt: Date.now() + 5000, value: settings };
    return settings;
  })();

  try {
    return await settingsRequest;
  } finally {
    settingsRequest = null;
  }
}

function hashApiKey(apiKey: string): Buffer {
  return createHash("sha256").update(apiKey).digest();
}

function checkRateLimit(request: Request, keyHash: string, limit: number): boolean {
  const now = Date.now();
  const forwardedFor = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const bucketKey = `${keyHash}:${clientIp}`;
  const current = rateWindows.get(bucketKey);

  if (!current || now - current.startedAt >= 60_000) {
    rateWindows.set(bucketKey, { startedAt: now, count: 1 });
    if (rateWindows.size > 5000) {
      for (const [key, window] of rateWindows) {
        if (now - window.startedAt >= 60_000) rateWindows.delete(key);
      }
    }
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function authorizeExternalApiRequest(
  request: Request,
  options?: { allowMaintenance?: boolean }
): Promise<AuthorizationResult> {
  let settings: AppSettings;
  try {
    settings = await getCurrentAppSettings();
  } catch (error) {
    const status = error instanceof FirestoreRestError && error.status === 504 ? 504 : 503;
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "External API settings are unavailable" },
        { status }
      ),
    };
  }

  if (!settings.externalApiKeyHash) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "External API key is not configured" },
        { status: 503 }
      ),
    };
  }

  const providedKey = request.headers.get("x-api-key");
  if (!providedKey || providedKey.length > 256) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "A valid x-api-key header is required" },
        { status: 401 }
      ),
    };
  }

  const actualHash = hashApiKey(providedKey);
  const expectedHash = Buffer.from(settings.externalApiKeyHash, "hex");
  if (expectedHash.length !== actualHash.length || !timingSafeEqual(expectedHash, actualHash)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 403 }
      ),
    };
  }

  if (!checkRateLimit(request, actualHash.toString("hex"), settings.rateLimitPerMinute)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } }
      ),
    };
  }

  if (!options?.allowMaintenance && settings.maintenanceMode) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          code: "MAINTENANCE",
          message: settings.maintenanceMessage,
          announcement: settings.announcement,
        },
        { status: 503 }
      ),
    };
  }

  return { authorized: true, settings };
}

export function externalApiMetadata(settings: AppSettings) {
  return {
    announcement: settings.announcement,
    minimumAppVersion: settings.minimumAppVersion,
    defaultCategory: settings.defaultCategory,
    showNsfw: settings.showNsfw,
  };
}
