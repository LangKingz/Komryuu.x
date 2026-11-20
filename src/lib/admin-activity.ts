import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AuditLogEntry {
  id?: string;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
  timestamp?: unknown;
}

export async function logAdminAction(
  adminEmail: string,
  action: string,
  target: string,
  details: string,
  category?: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await addDoc(collection(db, "AUDIT_LOGS"), {
      adminEmail: adminEmail || "admin@komryuu.x",
      action,
      target: target || "General",
      details: details || "",
      category: category || "general",
      createdAt: nowIso,
      timestamp: serverTimestamp(),
    });

    // Catat juga ke collection ACTIVITY untuk kompatibilitas riwayat lama
    await addDoc(collection(db, "ACTIVITY"), {
      action,
      detail: target ? `[${target}] ${details}` : details,
      userId: adminEmail || "admin",
      createdAt: nowIso,
    });
  } catch (err) {
    console.error("Gagal mencatat audit log admin:", err);
  }
}

export async function recordAdminActivity(
  action: string,
  detail: string,
  userId?: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await addDoc(collection(db, "ACTIVITY"), {
      action,
      detail,
      ...(userId ? { userId } : {}),
      createdAt: nowIso,
    });
  } catch (err) {
    console.error("Gagal mencatat aktivitas admin:", err);
  }
}
