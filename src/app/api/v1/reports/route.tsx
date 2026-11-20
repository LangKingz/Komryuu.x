import { NextResponse } from "next/server";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { success: false, error: "message is required" },
      { status: 400 }
    );
  }

  const type =
    typeof body.type === "string" && body.type.trim()
      ? body.type.trim()
      : "app_bug";
  const extensionId =
    typeof body.extensionId === "string" ? body.extensionId.trim() : "";
  const comicTitle =
    typeof body.comicTitle === "string" ? body.comicTitle.trim() : "";
  const chapterNumber =
    typeof body.chapterNumber === "string" || typeof body.chapterNumber === "number"
      ? String(body.chapterNumber).trim()
      : "";
  const userEmail =
    typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  const appVersion =
    typeof body.appVersion === "string" ? body.appVersion.trim() : "1.0.0";
  const deviceInfo =
    isRecord(body.deviceInfo) || typeof body.deviceInfo === "string"
      ? body.deviceInfo
      : {};

  try {
    const reportRef = await addDoc(collection(db, "REPORTS"), {
      type,
      extensionId,
      comicTitle,
      chapterNumber,
      message,
      userEmail,
      uid,
      appVersion,
      deviceInfo,
      status: "pending", // pending | in_progress | resolved
      adminNotes: "",
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        reportId: reportRef.id,
        message: "Laporan berhasil diterima dan akan ditinjau oleh administrator.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create report failed", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}
