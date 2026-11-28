import { NextResponse } from "next/server";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";
import { authorizeAdminApiRequest } from "@/lib/admin-api";
import { recordAdminActivity } from "@/lib/admin-activity";
import {
  DEFAULT_FEATURE_FLAGS,
  normalizeAppSettings,
  type AppReleaseItem,
  type FeatureState,
} from "@/model/app-settings";

export const dynamic = "force-dynamic";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

async function authorizeWriteRequest(request: Request) {
  if (request.headers.get("x-admin-api-key")) {
    const adminAuth = authorizeAdminApiRequest(request);
    if (adminAuth) return { authorized: false, response: adminAuth };
    return { authorized: true };
  }

  const externalAuth = await authorizeExternalApiRequest(request, {
    allowMaintenance: true,
  });
  if (!externalAuth.authorized) {
    return { authorized: false, response: externalAuth.response };
  }
  return { authorized: true };
}

export async function GET(request: Request) {
  const hasApiKey = Boolean(request.headers.get("x-api-key"));
  if (hasApiKey) {
    const authorization = await authorizeExternalApiRequest(request, {
      allowMaintenance: true,
    });
    if (!authorization.authorized) return authorization.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") || "";

    const configSnap = await getDoc(doc(db, "SETTINGS", "app_config"));
    const rawData = configSnap.exists()
      ? (configSnap.data() as Record<string, unknown>)
      : {};

    const settings = normalizeAppSettings(rawData);

    const announcement = settings.appAnnouncement ?? {
      active: settings.broadcastBanner.isActive,
      title: settings.broadcastBanner.title || "",
      message: settings.broadcastBanner.message || "",
      type:
        settings.broadcastBanner.type === "warning" || settings.broadcastBanner.type === "urgent"
          ? ("warning" as const)
          : settings.broadcastBanner.type === "update"
            ? ("update" as const)
            : ("info" as const),
    };

    // Determine which releases to expose based on role
    const allReleases = settings.releases ?? [];
    const isPrivileged = role === "vip" || role === "moderator" || role === "admin";
    const visibleReleases: AppReleaseItem[] = isPrivileged
      ? allReleases
      : allReleases.filter((r) => r.channel === "stable");

    // Resolve active release
    let activeRelease: AppReleaseItem | undefined;

    if (settings.activeReleaseId && allReleases.length > 0) {
      activeRelease = allReleases.find((r) => r.id === settings.activeReleaseId);
    }

    // If no active release found, pick the latest visible one
    if (!activeRelease && visibleReleases.length > 0) {
      const sorted = [...visibleReleases].sort(
        (a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()
      );
      activeRelease = sorted[0];
    }

    // Build response values — override from active release if available
    const latestVersion = activeRelease?.versionName || settings.latestVersion || settings.appUpdate.latestAppVersion || "1.1";
    const minVersionCode = settings.minVersionCode ?? settings.appUpdate.minVersionCode ?? 1;
    const forceUpdate = activeRelease?.forceUpdate ?? settings.forceUpdate ?? settings.appUpdate.forceUpdate ?? false;
    const changelog = activeRelease?.changelog || settings.changelog || settings.appUpdate.changelog || "";
    const apkUrl = activeRelease?.apkUrl || settings.apkUrl || settings.appUpdate.downloadUrl || "/aplikasi/Komryuu.apk";
    const fileSize = activeRelease?.fileSize || "";
    const releasedAt = activeRelease?.releasedAt || "";
    const channel = activeRelease?.channel || "stable";

    return NextResponse.json({
      success: true,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      latestVersion,
      minVersionCode,
      forceUpdate,
      changelog,
      apkUrl,
      fileSize,
      releasedAt,
      channel,
      announcement,
      releases: visibleReleases,
      featureFlags: settings.featureFlags,
      // Backward compatibility keys
      broadcastBanner: settings.broadcastBanner,
      appUpdate: settings.appUpdate,
    });
  } catch (error) {
    console.error("Get app config failed", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await authorizeWriteRequest(request);
  if (!authCheck.authorized) return authCheck.response;

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

  try {
    const configRef = doc(db, "SETTINGS", "app_config");
    const configSnap = await getDoc(configRef);
    const existingData = configSnap.exists()
      ? (configSnap.data() as Record<string, unknown>)
      : {};

    const existingUpdate = (existingData.appUpdate && typeof existingData.appUpdate === "object")
      ? (existingData.appUpdate as Record<string, unknown>)
      : {};
    const existingBanner = (existingData.broadcastBanner && typeof existingData.broadcastBanner === "object")
      ? (existingData.broadcastBanner as Record<string, unknown>)
      : {};
    const existingAnnouncement = (existingData.appAnnouncement && typeof existingData.appAnnouncement === "object")
      ? (existingData.appAnnouncement as Record<string, unknown>)
      : {};

    // Build partial updates without wiping other fields
    const updates: Record<string, unknown> = {};

    // 1. Maintenance Mode
    if (body.maintenanceMode !== undefined || body.isMaintenance !== undefined) {
      const mode = body.maintenanceMode !== undefined ? Boolean(body.maintenanceMode) : Boolean(body.isMaintenance);
      updates.maintenanceMode = mode;
      updates.isMaintenance = mode;
    }
    if (body.maintenanceMessage !== undefined || body.activeMaintenanceMessage !== undefined) {
      const msg = String(body.maintenanceMessage ?? body.activeMaintenanceMessage ?? "");
      updates.maintenanceMessage = msg;
      updates.activeMaintenanceMessage = msg;
    }

    // 2. Announcement & Broadcast Banner
    let bannerTitle = typeof body.bannerTitle === "string" ? body.bannerTitle : undefined;
    let bannerMessage = typeof body.bannerMessage === "string" ? body.bannerMessage : undefined;
    let bannerType = typeof body.bannerType === "string" ? body.bannerType : undefined;
    let bannerActive = typeof body.bannerActive === "boolean" ? body.bannerActive : undefined;

    if (typeof body.announcement === "string") {
      bannerMessage = body.announcement;
      updates.announcement = body.announcement;
    } else if (isRecord(body.announcement)) {
      if (body.announcement.title !== undefined) bannerTitle = String(body.announcement.title);
      if (body.announcement.message !== undefined) bannerMessage = String(body.announcement.message);
      if (body.announcement.type !== undefined) bannerType = String(body.announcement.type);
      if (body.announcement.active !== undefined) bannerActive = Boolean(body.announcement.active);
    }

    if (isRecord(body.broadcastBanner)) {
      if (body.broadcastBanner.title !== undefined) bannerTitle = String(body.broadcastBanner.title);
      if (body.broadcastBanner.message !== undefined) bannerMessage = String(body.broadcastBanner.message);
      if (body.broadcastBanner.type !== undefined) bannerType = String(body.broadcastBanner.type);
      if (body.broadcastBanner.isActive !== undefined) bannerActive = Boolean(body.broadcastBanner.isActive);
    }

    if (bannerTitle !== undefined || bannerMessage !== undefined || bannerType !== undefined || bannerActive !== undefined) {
      const finalTitle = bannerTitle !== undefined ? bannerTitle : String(existingBanner.title ?? existingAnnouncement.title ?? "");
      const finalMessage = bannerMessage !== undefined ? bannerMessage : String(existingBanner.message ?? existingAnnouncement.message ?? existingData.announcement ?? "");
      const finalType = bannerType !== undefined ? bannerType : String(existingBanner.type ?? existingAnnouncement.type ?? "info");
      const finalActive = bannerActive !== undefined ? bannerActive : Boolean(existingBanner.isActive ?? existingAnnouncement.active ?? false);

      updates.bannerTitle = finalTitle;
      updates.bannerMessage = finalMessage;
      updates.bannerType = finalType;
      updates.bannerActive = finalActive;
      updates.announcement = finalMessage;

      updates.broadcastBanner = {
        isActive: finalActive,
        title: finalTitle,
        message: finalMessage,
        type: finalType,
      };

      updates.appAnnouncement = {
        active: finalActive,
        title: finalTitle,
        message: finalMessage,
        type: finalType === "warning" || finalType === "urgent" ? "warning" : finalType === "update" ? "update" : "info",
      };
    }

    // 3. App Version & Update Controls
    if (body.latestVersion !== undefined || body.latestAppVersion !== undefined) {
      const v = String(body.latestVersion ?? body.latestAppVersion ?? "").trim();
      if (v) updates.latestVersion = v;
    }
    if (body.minVersionCode !== undefined) {
      const c = Number(body.minVersionCode);
      if (!isNaN(c)) updates.minVersionCode = c;
    }
    if (body.forceUpdate !== undefined) {
      updates.forceUpdate = Boolean(body.forceUpdate);
    }
    if (body.changelog !== undefined) {
      updates.changelog = String(body.changelog);
    }
    if (body.apkUrl !== undefined || body.downloadUrl !== undefined) {
      const url = String(body.apkUrl ?? body.downloadUrl ?? "").trim();
      if (url) updates.apkUrl = url;
    }
    if (body.fileSize !== undefined) {
      updates.fileSize = String(body.fileSize);
    }

    // Keep nested appUpdate object in sync
    const nextLatest = updates.latestVersion !== undefined ? String(updates.latestVersion) : String(existingData.latestVersion ?? existingUpdate.latestAppVersion ?? "1.1");
    const nextApkUrl = updates.apkUrl !== undefined ? String(updates.apkUrl) : String(existingData.apkUrl ?? existingUpdate.downloadUrl ?? "/aplikasi/Komryuu.apk");
    const nextChangelog = updates.changelog !== undefined ? String(updates.changelog) : String(existingData.changelog ?? existingUpdate.changelog ?? "");
    const nextMinCode = updates.minVersionCode !== undefined ? Number(updates.minVersionCode) : Number(existingData.minVersionCode ?? existingUpdate.minVersionCode ?? 1);
    const nextForce = updates.forceUpdate !== undefined ? Boolean(updates.forceUpdate) : Boolean(existingData.forceUpdate ?? existingUpdate.forceUpdate ?? false);

    updates.appUpdate = {
      ...existingUpdate,
      latestVersion: nextLatest,
      latestAppVersion: nextLatest,
      apkUrl: nextApkUrl,
      downloadUrl: nextApkUrl,
      changelog: nextChangelog,
      minVersionCode: nextMinCode,
      forceUpdate: nextForce,
    };

    // 4. Release History & Active Release
    if (Array.isArray(body.releases)) {
      updates.releases = body.releases;
    }
    if (typeof body.activeReleaseId === "string") {
      updates.activeReleaseId = body.activeReleaseId;
    }

    // 5. Additional Settings & Feature Flags
    if (isRecord(body.featureFlags)) {
      const existingFlags = isRecord(existingData.featureFlags) ? existingData.featureFlags : {};
      const mergedFlags: Record<string, FeatureState> = { ...DEFAULT_FEATURE_FLAGS };

      for (const [k, v] of Object.entries(existingFlags)) {
        if (v === "enabled" || v === "admin_only" || v === "coming_soon") {
          mergedFlags[k] = v;
        }
      }
      for (const [k, v] of Object.entries(body.featureFlags)) {
        if (v === "enabled" || v === "admin_only" || v === "coming_soon") {
          mergedFlags[k] = v;
        }
      }
      updates.featureFlags = mergedFlags;
    }

    if (body.allowRegistration !== undefined) updates.allowRegistration = Boolean(body.allowRegistration);
    if (body.showNsfw !== undefined) updates.showNsfw = Boolean(body.showNsfw);
    if (typeof body.defaultCategory === "string") updates.defaultCategory = body.defaultCategory;
    if (typeof body.rateLimitPerMinute === "number") updates.rateLimitPerMinute = body.rateLimitPerMinute;
    if (typeof body.extensionCacheTtlSeconds === "number") updates.extensionCacheTtlSeconds = body.extensionCacheTtlSeconds;

    updates.updatedAt = new Date().toISOString();

    // Perform partial merge in Firestore
    await setDoc(configRef, updates, { merge: true });

    try {
      const actionDesc = updates.maintenanceMode !== undefined
        ? `Maintenance Mode diubah ke: ${updates.maintenanceMode ? "AKTIF" : "NONAKTIF"}`
        : updates.announcement !== undefined
          ? `Pengumuman broadcast server diperbarui`
          : `Konfigurasi aplikasi diperbarui via API`;
      await recordAdminActivity("Konfigurasi Diperbarui", actionDesc);
    } catch (logErr) {
      console.warn("Audit log failed for config update", logErr);
    }

    return NextResponse.json({
      success: true,
      message: "Konfigurasi aplikasi berhasil diperbarui",
      updatedFields: Object.keys(updates),
    });
  } catch (error) {
    console.error("Update app config failed:", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function PATCH(request: Request) {
  return POST(request);
}
