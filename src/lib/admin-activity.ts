import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AuditCategory = "security" | "extension" | "settings" | "user" | "system";

export async function logAdminAction(
  adminEmail: string,
  action: string,
  target: string,
  details: string,
  category: AuditCategory = "system"
): Promise<void> {
  try {
    await addDoc(collection(db, "AUDIT_LOGS"), {
      adminEmail: adminEmail || "admin@komryuu.core",
      action,
      target,
      details,
      category,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write to AUDIT_LOGS:", err);
  }
}

export async function recordAdminActivity(
  action: string,
  detail: string,
  userId?: string
): Promise<void> {
  try {
    await addDoc(collection(db, "ACTIVITY"), {
      action,
      detail,
      ...(userId ? { userId } : {}),
      createdAt: new Date().toISOString(),
    });

    // Otomatis sinkronkan ke AUDIT_LOGS
    await logAdminAction(
      "admin@komryuu.core",
      action,
      userId ? `User: ${userId}` : "System",
      detail,
      userId ? "user" : "system"
    );
  } catch (err) {
    console.error("Failed to record admin activity:", err);
  }
}
