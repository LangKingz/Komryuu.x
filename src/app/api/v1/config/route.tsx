import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";
import { normalizeAppSettings, type AppReleaseItem } from "@/model/app-settings";

export const dynamic = "force-dynamic";

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
    const latestVersion = activeRelease?.versionName || settings.latestVersion || settings.appUpdate.latestAppVersion || "1.2.0";
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
