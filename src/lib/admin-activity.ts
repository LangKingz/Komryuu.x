import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function recordAdminActivity(
  action: string,
  detail: string,
  userId?: string
): Promise<void> {
  await addDoc(collection(db, "ACTIVITY"), {
    action,
    detail,
    ...(userId ? { userId } : {}),
    createdAt: new Date().toISOString(),
  });
}
