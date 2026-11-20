import { NextResponse } from "next/server";
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";

export const dynamic = "force-dynamic";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (!title) {
    return NextResponse.json(
      { success: false, error: "title is required" },
      { status: 400 }
    );
  }

  if (!description) {
    return NextResponse.json(
      { success: false, error: "description or message is required" },
      { status: 400 }
    );
  }

  const rawType = typeof body.type === "string" ? body.type.trim().toLowerCase() : "feedback";
  const validTypes = ["scraper_error", "broken_chapter", "bug", "feedback"] as const;
  const type = validTypes.includes(rawType as (typeof validTypes)[number])
    ? rawType
    : "feedback";

  const extensionName = typeof body.extensionName === "string" ? body.extensionName.trim() : "";
  const comicId = typeof body.comicId === "string" ? body.comicId.trim() : "";
  const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle.trim() : "";
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";

  let deviceInfo: Record<string, unknown> = {};
  if (isRecord(body.deviceInfo)) {
    deviceInfo = body.deviceInfo;
  } else if (typeof body.deviceInfo === "string") {
    deviceInfo = { model: body.deviceInfo };
  }

  try {
    const reportRef = await addDoc(collection(db, "REPORTS"), {
      type,
      title,
      description,
      extensionName,
      comicId,
      chapterTitle,
      userEmail,
      uid,
      deviceInfo,
      status: "pending", // pending | in_progress | resolved
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        reportId: reportRef.id,
        message: "Laporan berhasil diterima dan tercatat di antrean perbaikan.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Save report failed:", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

export async function GET(request: Request) {
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const reportsQuery = query(
      collection(db, "REPORTS"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(reportsQuery);
    const reports = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));

    return NextResponse.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Fetch reports failed:", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}
