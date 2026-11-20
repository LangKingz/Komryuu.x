import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAdminAction } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

export const ADMIN_PERMISSIONS = {
  canAccessAdminPanel: true,
  canManageExtensions: true,
  canBanUsers: true,
  bypassRateLimit: true,
  canAccessNsfw: true,
};

async function processAdminPromotion(identifier: {
  name?: string;
  email?: string;
  uid?: string;
}) {
  const targetName = (identifier.name || "").trim().toLowerCase();
  const targetEmail = (identifier.email || "").trim().toLowerCase();
  const targetUid = (identifier.uid || "").trim();

  const updatedAdmins: Array<{
    uid: string;
    name: string;
    email: string;
    role: string;
  }> = [];

  // Jika spesifik UID
  if (targetUid) {
    const userRef = doc(db, "USERS", targetUid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      await updateDoc(userRef, {
        role: "admin",
        permissions: ADMIN_PERMISSIONS,
        isBanned: false,
        updatedAt: serverTimestamp(),
      });
      updatedAdmins.push({
        uid: targetUid,
        name: typeof data.name === "string" ? data.name : "Admin",
        email: typeof data.email === "string" ? data.email : "",
        role: "admin",
      });
    }
  } else {
    // Cari pengguna di koleksi USERS
    const snap = await getDocs(collection(db, "USERS"));
    for (const d of snap.docs) {
      const data = d.data();
      const userName = (typeof data.name === "string" ? data.name : "").toLowerCase();
      const userEmail = (typeof data.email === "string" ? data.email : "").toLowerCase();

      let matched = false;
      if (targetEmail && userEmail.includes(targetEmail)) {
        matched = true;
      } else if (targetName && (userName.includes(targetName) || userEmail.includes(targetName))) {
        matched = true;
      } else if (!targetName && !targetEmail && (userName.includes("gilang") || userEmail.includes("gilang"))) {
        // Default ke "Gilang" jika tanpa parameter
        matched = true;
      }

      if (matched) {
        await updateDoc(doc(db, "USERS", d.id), {
          role: "admin",
          permissions: ADMIN_PERMISSIONS,
          isBanned: false,
          updatedAt: serverTimestamp(),
        });
        updatedAdmins.push({
          uid: d.id,
          name: typeof data.name === "string" ? data.name : "Admin",
          email: typeof data.email === "string" ? data.email : "",
          role: "admin",
        });
      }
    }
  }

  return updatedAdmins;
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const { searchParams } = new URL(request.url);
  const name =
    (typeof body.name === "string" ? body.name : searchParams.get("name")) || "Gilang";
  const email =
    (typeof body.email === "string" ? body.email : searchParams.get("email")) || "";
  const uid =
    (typeof body.uid === "string" ? body.uid : searchParams.get("uid")) || "";

  try {
    const updatedAdmins = await processAdminPromotion({ name, email, uid });

    if (updatedAdmins.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Tidak ditemukan pengguna dengan nama/email/uid "${name || email || uid}". Pastikan akun sudah login minimal 1 kali di halaman /login agar dokumen USERS dibuat.`,
          hint: "Buka /login di browser, lakukan Sign in with Google (Gilang), lalu hit endpoint ini kembali.",
        },
        { status: 404 }
      );
    }

    await logAdminAction(
      updatedAdmins[0].email || "admin@komryuu.core",
      "Akun Dipromosikan Menjadi Admin",
      updatedAdmins.map((a) => a.name).join(", "),
      `Berhasil memberikan role admin & full permissions via Postman hit point`,
      "security"
    );

    const primaryAdmin = updatedAdmins[0];
    const response = NextResponse.json({
      success: true,
      message: `🎉 Berhasil! Akun ${primaryAdmin.name} (${primaryAdmin.email || primaryAdmin.uid}) telah resmi menjadi ADMINISTRATOR!`,
      totalUpdated: updatedAdmins.length,
      admins: updatedAdmins,
      permissions: ADMIN_PERMISSIONS,
      instructions: [
        "1. Buka browser dan refresh halaman http://localhost:3000/dashboard",
        "2. Jika belum login, buka http://localhost:3000/login dan masuk dengan akun Google Gilang.",
        "3. Anda sekarang memiliki hak akses penuh ke seluruh fitur Admin Dashboard!",
      ],
    });

    // Pasang cookie sesi agar langsung bisa akses dashboard jika dibuka via browser/Postman web
    response.cookies.set("komryuu_session", primaryAdmin.uid, {
      path: "/",
      maxAge: 604800,
      sameSite: "lax",
    });
    response.cookies.set("komryuu_role", "admin", {
      path: "/",
      maxAge: 604800,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Setup admin error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal memperbarui role admin di Firestore",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Dukung juga method GET agar bisa langsung diklik di browser maupun Postman GET request
export async function GET(request: Request) {
  return POST(request);
}
