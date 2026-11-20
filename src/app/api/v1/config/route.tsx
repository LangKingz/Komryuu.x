import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";
import { normalizeAppSettings } from "@/model/app-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await authorizeExternalApiRequest(request, {
    allowMaintenance: true,
  });
  if (!authorization.authorized) return authorization.response;

  try {
    const configSnap = await getDoc(doc(db, "SETTINGS", "app_config"));
    const rawData = configSnap.exists()
      ? (configSnap.data() as Record<string, unknown>)
      : {};

    const settings = normalizeAppSettings(rawData);

    return NextResponse.json({
      success: true,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
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
