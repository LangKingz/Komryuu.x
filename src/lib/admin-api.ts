import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export function authorizeAdminApiRequest(request: Request): NextResponse | null {
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    return NextResponse.json(
      { success: false, error: "Admin API is not configured" },
      { status: 503 }
    );
  }

  const providedKey = request.headers.get("x-admin-api-key");
  if (!providedKey) {
    return NextResponse.json(
      { success: false, error: "Admin API key required" },
      { status: 401 }
    );
  }

  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return NextResponse.json(
      { success: false, error: "Invalid admin API key" },
      { status: 403 }
    );
  }

  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
