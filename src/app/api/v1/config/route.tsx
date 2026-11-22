import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";
import { normalizeAppSettings } from "@/model/app-settings";

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

    const latestVersion = settings.latestVersion || settings.appUpdate.latestAppVersion || "1.2.0";
    const minVersionCode = settings.minVersionCode ?? settings.appUpdate.minVersionCode ?? 1;
    const forceUpdate = settings.forceUpdate ?? settings.appUpdate.forceUpdate ?? false;
    const changelog = settings.changelog || settings.appUpdate.changelog || "";
    const apkUrl = settings.apkUrl || settings.appUpdate.downloadUrl || "/aplikasi/Komryuu.apk";

    return NextResponse.json({
      success: true,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      latestVersion,
      minVersionCode,
      forceUpdate,
      changelog,
      apkUrl,
      announcement,
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
