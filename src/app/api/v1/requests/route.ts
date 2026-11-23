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
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

// GET /api/v1/requests
// Return list of feature/extension requests sorted by popularity (upvotes) or newest
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type")?.trim().toLowerCase();
    const status = searchParams.get("status")?.trim().toLowerCase();
    const sort = searchParams.get("sort")?.trim().toLowerCase() || "popular"; // popular | newest
    const maxLimit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

    const requestsQuery = query(
      collection(db, "FEATURE_REQUESTS"),
      orderBy("createdAt", "desc"),
      limit(maxLimit)
    );

    const snap = await getDocs(requestsQuery);
    let requests = snap.docs.map((docItem) => {
      const data = docItem.data();
      const rawUpvotes = Array.isArray(data.upvotes) ? data.upvotes : [];
      const upvotes = rawUpvotes.filter((u): u is string => typeof u === "string");

      return {
        id: docItem.id,
        title: typeof data.title === "string" ? data.title : "Tanpa Judul",
        type: data.type === "feature" ? ("feature" as const) : ("extension" as const),
        description: typeof data.description === "string" ? data.description : "",
        createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
        createdByName: typeof data.createdByName === "string" ? data.createdByName : "Pengguna Komryuu",
        upvotes,
        upvoteCount: upvotes.length,
        status: (data.status === "planned" || data.status === "completed"
          ? data.status
          : "open") as "open" | "planned" | "completed",
        adminNote: typeof data.adminNote === "string" ? data.adminNote : "",
        createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
      };
    });

    if (type && (type === "extension" || type === "feature")) {
      requests = requests.filter((r) => r.type === type);
    }

    if (status && (status === "open" || status === "planned" || status === "completed")) {
      requests = requests.filter((r) => r.status === status);
    }

    if (sort === "popular") {
      requests.sort((a, b) => b.upvoteCount - a.upvoteCount);
    } else {
      requests.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Fetch feature requests failed:", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

// POST /api/v1/requests
// Submit a new extension or feature request
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ success: false, error: "Request body must be an object" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const rawType = typeof body.type === "string" ? body.type.trim().toLowerCase() : "extension";
  const type = rawType === "feature" ? "feature" : "extension";

  if (!title) {
    return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json({ success: false, error: "description is required" }, { status: 400 });
  }

  const createdByUid = typeof body.createdByUid === "string" ? body.createdByUid.trim() : `guest-${Date.now()}`;
  const createdByName = typeof body.createdByName === "string" && body.createdByName.trim()
    ? body.createdByName.trim()
    : "Pengguna Komryuu";

  // Submitter automatically upvotes their own request
  const upvotes = createdByUid ? [createdByUid] : [];

  try {
    const docRef = await addDoc(collection(db, "FEATURE_REQUESTS"), {
      title,
      type,
      description,
      createdByUid,
      createdByName,
      upvotes,
      status: "open",
      adminNote: "",
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        message: "Request berhasil diajukan dan dipublikasikan ke papan voting.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create feature request failed:", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

// PATCH /api/v1/requests
// Handles:
// 1) Vote toggle: { action: "vote", id: string, uid: string }
// 2) Admin status update: { action: "status", id: string, status: "open"|"planned"|"completed", adminNote?: string }
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ success: false, error: "Request body must be an object" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "vote";

  try {
    const requestRef = doc(db, "FEATURE_REQUESTS", id);
    const existingSnap = await getDoc(requestRef);
    if (!existingSnap.exists()) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const data = existingSnap.data();

    // 1. Voting action
    if (action === "vote") {
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";
      if (!uid) {
        return NextResponse.json({ success: false, error: "uid is required for voting" }, { status: 400 });
      }

      const rawUpvotes = Array.isArray(data.upvotes) ? data.upvotes : [];
      let upvotes = rawUpvotes.filter((u): u is string => typeof u === "string");
      let voted = false;

      if (upvotes.includes(uid)) {
        // Toggle off
        upvotes = upvotes.filter((u) => u !== uid);
        voted = false;
      } else {
        // Toggle on
        upvotes = [...upvotes, uid];
        voted = true;
      }

      await updateDoc(requestRef, {
        upvotes,
        updatedAt: serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        voted,
        upvoteCount: upvotes.length,
        message: voted ? "Upvote berhasil ditambahkan." : "Upvote dibatalkan.",
      });
    }

    // 2. Admin status update action
    if (action === "status") {
      const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
      if (status !== "open" && status !== "planned" && status !== "completed") {
        return NextResponse.json(
          { success: false, error: "status must be 'open', 'planned', or 'completed'" },
          { status: 400 }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (body.adminNote !== undefined) {
        updates.adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
      }

      await updateDoc(requestRef, updates);

      try {
        await recordAdminActivity(
          "Status Request Diperbarui",
          `Request ${id} ("${data.title || "Request"}") diubah ke status: ${status.toUpperCase()}`,
          id
        );
      } catch (logErr) {
        console.error("Audit log failed for request status update", logErr);
      }

      return NextResponse.json({
        success: true,
        message: "Status request berhasil diperbarui.",
        id,
        status,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'vote' or 'status'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update request failed:", error);
    return NextResponse.json(
      { success: false, error: "Firebase service is unavailable" },
      { status: 502 }
    );
  }
}

// DELETE /api/v1/requests
// Admin can delete inappropriate request
export async function DELETE(request: Request) {
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
    const requestRef = doc(db, "FEATURE_REQUESTS", id);
    const existingSnap = await getDoc(requestRef);
    if (!existingSnap.exists()) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const title = existingSnap.data()?.title || id;
    await deleteDoc(requestRef);

    try {
      await recordAdminActivity("Request Komunitas Dihapus", `Request ${id} ("${title}") dihapus`, id);
    } catch (logErr) {
      console.error("Audit log failed for request delete", logErr);
    }

    return NextResponse.json({
      success: true,
      message: "Request berhasil dihapus",
      id,
    });
  } catch (error) {
    console.error("Delete request failed:", error);
    return NextResponse.json({ success: false, error: "Firebase service is unavailable" }, { status: 502 });
  }
}
