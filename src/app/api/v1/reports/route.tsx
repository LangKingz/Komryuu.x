import { NextResponse } from "next/server";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authorizeExternalApiRequest } from "@/lib/external-api";
import { authorizeAdminApiRequest } from "@/lib/admin-api";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function toIsoDateString(val: unknown, fallback?: string): string {
  if (!val) return fallback || new Date().toISOString();

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? fallback || new Date().toISOString() : val.toISOString();
  }

  // Firestore Timestamp object with toDate()
  if (typeof val === "object" && val !== null && "toDate" in val) {
    const toDate = (val as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      try {
        const d = toDate.call(val);
        if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
      } catch {
        // ignore
      }
    }
  }

  // Firestore serialized timestamp: { _seconds, _nanoseconds } or { seconds, nanoseconds }
  if (typeof val === "object" && val !== null) {
    const sec =
      "_seconds" in val
        ? Number((val as { _seconds: unknown })._seconds)
        : "seconds" in val
        ? Number((val as { seconds: unknown }).seconds)
        : NaN;

    if (!isNaN(sec) && sec > 0) {
      return new Date(sec * 1000).toISOString();
    }
  }

  if (typeof val === "number" && !isNaN(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
    return trimmed;
  }

  return fallback || new Date().toISOString();
}

async function authorizeAdminOrMobileRequest(request: Request) {
  // 1. Allow if x-admin-api-key is present and matches
  if (request.headers.get("x-admin-api-key")) {
    const adminAuth = authorizeAdminApiRequest(request);
    if (adminAuth) return { authorized: false, response: adminAuth };
    return { authorized: true };
  }

  // 2. Standard external API key authorization
  const externalAuth = await authorizeExternalApiRequest(request, { allowMaintenance: true });
  if (!externalAuth.authorized) {
    return { authorized: false, response: externalAuth.response };
  }
  return { authorized: true };
}

export async function POST(request: Request) {
  const authCheck = await authorizeAdminOrMobileRequest(request);
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
  const targetUrl =
    typeof body.targetUrl === "string"
      ? body.targetUrl.trim()
      : typeof body.url === "string"
      ? body.url.trim()
      : typeof body.link === "string"
      ? body.link.trim()
      : "";
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";

  let deviceInfo: Record<string, unknown> = {};
  if (isRecord(body.deviceInfo)) {
    deviceInfo = body.deviceInfo;
  } else if (typeof body.deviceInfo === "string") {
    deviceInfo = { model: body.deviceInfo };
  }

  try {
    const nowIso = new Date().toISOString();
    const reportRef = await addDoc(collection(db, "REPORTS"), {
      type,
      title,
      description,
      extensionName,
      comicId,
      chapterTitle,
      targetUrl,
      userEmail,
      uid,
      deviceInfo,
      status: "pending", // pending | in_progress | resolved
      adminNote: "",
      createdAt: nowIso,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        reportId: reportRef.id,
        message: "Laporan berhasil diterima dan tercatat di antrean perbaikan.",
        createdAt: nowIso,
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
  const authCheck = await authorizeAdminOrMobileRequest(request);
  if (!authCheck.authorized) return authCheck.response;

  try {
    const reportsQuery = query(
      collection(db, "REPORTS"),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const snap = await getDocs(reportsQuery);
    const reports = snap.docs.map((docItem) => {
      const data = docItem.data();
      return {
        id: docItem.id,
        ...data,
        createdAt: toIsoDateString(data.createdAt),
        updatedAt: data.updatedAt ? toIsoDateString(data.updatedAt) : undefined,
      };
    });

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

export async function PATCH(request: Request) {
  const authCheck = await authorizeAdminOrMobileRequest(request);
  if (!authCheck.authorized) return authCheck.response;

  const { searchParams } = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json();
    if (isRecord(raw)) body = raw;
  } catch {
    // query param fallback
  }

  // Extract ID flexibly
  const id = (
    searchParams.get("id")?.trim() ||
    searchParams.get("reportId")?.trim() ||
    (typeof body.id === "string" ? body.id.trim() : "") ||
    (typeof body.reportId === "string" ? body.reportId.trim() : "")
  );

  if (!id) {
    return NextResponse.json({ success: false, error: "id or reportId is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  // Support flexible status values from mobile
  if (body.status !== undefined) {
    const rawStatus = String(body.status).toLowerCase().trim();
    if (rawStatus === "pending" || rawStatus === "menunggu" || rawStatus === "open" || rawStatus === "antrean") {
      updates.status = "pending";
    } else if (
      rawStatus === "in_progress" ||
      rawStatus === "inprogress" ||
      rawStatus === "proses" ||
      rawStatus === "diproses" ||
      rawStatus === "sedang_diproses"
    ) {
      updates.status = "in_progress";
    } else if (
      rawStatus === "resolved" ||
      rawStatus === "selesai" ||
      rawStatus === "done" ||
      rawStatus === "closed" ||
      rawStatus === "teratasi"
    ) {
      updates.status = "resolved";
    } else {
      return NextResponse.json(
        { success: false, error: "status must be 'pending', 'in_progress', or 'resolved'" },
        { status: 400 }
      );
    }
  }

  // Support flexible admin note keys (adminNote, note, catatan)
  const incomingNote =
    body.adminNote !== undefined
      ? body.adminNote
      : body.note !== undefined
      ? body.note
      : body.catatan !== undefined
      ? body.catatan
      : body.admin_note !== undefined
      ? body.admin_note
      : undefined;

  if (incomingNote !== undefined) {
    if (typeof incomingNote !== "string") {
      return NextResponse.json({ success: false, error: "adminNote must be a string" }, { status: 400 });
    }
    updates.adminNote = incomingNote.trim();
  }

  try {
    const reportRef = doc(db, "REPORTS", id);
    const existingSnap = await getDoc(reportRef);
    if (!existingSnap.exists()) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }

    await updateDoc(reportRef, updates);

    const existingData = existingSnap.data();
    const actionDetail = updates.status
      ? `Tiket ${id} diubah ke status: ${String(updates.status).toUpperCase()}`
      : `Catatan admin diperbarui untuk tiket ${id}`;

    try {
      await recordAdminActivity("Tiket Laporan Diperbarui", actionDetail, id);
    } catch (logErr) {
      console.warn("Audit log failed for report update", logErr);
    }

    const nowIso = new Date().toISOString();
    return NextResponse.json({
      success: true,
      message: "Laporan berhasil diperbarui",
      id,
      report: {
        ...existingData,
        ...updates,
        id,
        createdAt: toIsoDateString(existingData.createdAt),
        updatedAt: nowIso,
      },
    });
  } catch (error) {
    console.error("Update report failed:", error);
    return NextResponse.json({ success: false, error: "Firebase service is unavailable" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}

export async function DELETE(request: Request) {
  const authCheck = await authorizeAdminOrMobileRequest(request);
  if (!authCheck.authorized) return authCheck.response;

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id")?.trim() || searchParams.get("reportId")?.trim();

  if (!id) {
    try {
      const body = await request.json();
      if (isRecord(body)) {
        if (typeof body.id === "string") id = body.id.trim();
        else if (typeof body.reportId === "string") id = body.reportId.trim();
      }
    } catch {
      // ignore
    }
  }

  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  try {
    const reportRef = doc(db, "REPORTS", id);
    const existingSnap = await getDoc(reportRef);
    if (!existingSnap.exists()) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }

    const title = existingSnap.data()?.title || id;
    await deleteDoc(reportRef);

    try {
      await recordAdminActivity("Tiket Laporan Dihapus", `Tiket ${id} (${title}) dihapus`, id);
    } catch (logErr) {
      console.warn("Audit log failed for report delete", logErr);
    }

    return NextResponse.json({
      success: true,
      message: "Laporan berhasil dihapus",
      id,
    });
  } catch (error) {
    console.error("Delete report failed:", error);
    return NextResponse.json({ success: false, error: "Firebase service is unavailable" }, { status: 502 });
  }
}
