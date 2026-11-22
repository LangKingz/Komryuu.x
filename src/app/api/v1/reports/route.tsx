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
import { recordAdminActivity } from "@/lib/admin-activity";

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
      limit(100)
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

export async function PATCH(request: Request) {
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json();
    if (isRecord(raw)) body = raw;
  } catch {
    // query param fallback
  }

  const id = searchParams.get("id")?.trim() || (typeof body.id === "string" ? body.id.trim() : "");
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (body.status !== undefined) {
    const rawStatus = String(body.status).toLowerCase();
    if (rawStatus === "pending" || rawStatus === "in_progress" || rawStatus === "resolved") {
      updates.status = rawStatus;
    } else {
      return NextResponse.json(
        { success: false, error: "status must be 'pending', 'in_progress', or 'resolved'" },
        { status: 400 }
      );
    }
  }

  if (body.adminNote !== undefined) {
    if (typeof body.adminNote !== "string") {
      return NextResponse.json({ success: false, error: "adminNote must be a string" }, { status: 400 });
    }
    updates.adminNote = body.adminNote.trim();
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
      console.error("Audit log failed for report update", logErr);
    }

    return NextResponse.json({
      success: true,
      message: "Laporan berhasil diperbarui",
      id,
      report: { ...existingData, ...updates, id },
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
  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id")?.trim();

  if (!id) {
    try {
      const body = await request.json();
      if (isRecord(body) && typeof body.id === "string") {
        id = body.id.trim();
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
      console.error("Audit log failed for report delete", logErr);
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
