import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authorizeAdminApiRequest, isRecord } from "@/lib/admin-api";
import {
  authorizeExternalApiRequest,
  externalApiMetadata,
} from "@/lib/external-api";
import {
  createFirestoreDocument,
  deleteFirestoreDocument,
  FirestoreRestError,
  getFirestoreDocument,
  listFirestoreDocuments,
  updateFirestoreDocument,
} from "@/lib/firestore-rest";
import { recordAdminActivity } from "@/lib/admin-activity";

const extensionTypes = ["komik", "anime", "cinema"] as const;
type ExtensionType = (typeof extensionTypes)[number];
type ExtensionValidationResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

type CachedExtensions = {
  expiresAt: number;
  data: Array<Record<string, unknown>>;
};

let cachedExtensions: CachedExtensions | null = null;
let extensionsRequest: Promise<Array<Record<string, unknown>>> | null = null;

function isExtensionType(value: unknown): value is ExtensionType {
  return typeof value === "string" && extensionTypes.includes(value as ExtensionType);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toExtensionData(body: Record<string, unknown>, partial = false): ExtensionValidationResult {
  const fields: Record<string, unknown> = {};
  const stringFields: Array<[string, string, string?]> = [
    ["name", "name"],
    ["description", "description"],
    ["logo", "logo"],
    ["type", "type"],
    ["BaseUrl", "BaseUrl", "url"],
    ["UrlSearch", "UrlSearch", "Urlsearch"],
    ["location", "location"],
    ["api", "api"],
  ];

  for (const [field, key, alternate] of stringFields) {
    let value = body[key] ?? (alternate ? body[alternate] : undefined);
    if (field === "BaseUrl" && value === undefined && typeof body.baseUrl === "string") {
      value = body.baseUrl;
    }
    if (value !== undefined && typeof value !== "string") {
      return { success: false, error: `${field} must be a string` };
    }
    if (typeof value === "string") {
      fields[field] = value.trim();
      if (field === "BaseUrl") {
        fields.baseUrl = value.trim();
      }
    } else if (!partial && ["name", "logo", "type", "BaseUrl"].includes(field)) {
      return { success: false, error: `${field} is required` };
    }
  }

  if (body.baseUrl !== undefined && typeof body.baseUrl === "string") {
    fields.baseUrl = body.baseUrl.trim();
    if (!fields.BaseUrl) fields.BaseUrl = fields.baseUrl;
  }

  if (body.mirrorUrls !== undefined) {
    if (!Array.isArray(body.mirrorUrls)) {
      return { success: false, error: "mirrorUrls must be an array of strings" };
    }
    const mirrors: string[] = [];
    for (const item of body.mirrorUrls) {
      if (typeof item === "string" && item.trim()) {
        const trimmed = item.trim();
        if (!isHttpUrl(trimmed)) {
          return { success: false, error: `Mirror URL "${trimmed}" must be an HTTP(S) URL` };
        }
        mirrors.push(trimmed);
      }
    }
    fields.mirrorUrls = mirrors;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { success: false, error: "isActive must be a boolean" };
    }
    fields.isActive = body.isActive;
    fields.status = body.isActive ? "active" : "inactive";
  } else if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "inactive") {
      return { success: false, error: "status must be active or inactive" };
    }
    fields.status = body.status;
    fields.isActive = body.status === "active";
  }

  if (body.isVipOnly !== undefined) {
    if (typeof body.isVipOnly !== "boolean") {
      return { success: false, error: "isVipOnly must be a boolean" };
    }
    fields.isVipOnly = body.isVipOnly;
  }

  if (body.customHeaders !== undefined) {
    if (typeof body.customHeaders !== "object" || body.customHeaders === null || Array.isArray(body.customHeaders)) {
      return { success: false, error: "customHeaders must be an object" };
    }
    const rawHeaders = body.customHeaders as Record<string, unknown>;
    const headers: { referer?: string; userAgent?: string; cookie?: string } = {};
    if (rawHeaders.referer !== undefined) {
      if (typeof rawHeaders.referer !== "string") return { success: false, error: "customHeaders.referer must be a string" };
      headers.referer = rawHeaders.referer.trim();
    }
    if (rawHeaders.userAgent !== undefined) {
      if (typeof rawHeaders.userAgent !== "string") return { success: false, error: "customHeaders.userAgent must be a string" };
      headers.userAgent = rawHeaders.userAgent.trim();
    }
    if (rawHeaders.cookie !== undefined) {
      if (typeof rawHeaders.cookie !== "string") return { success: false, error: "customHeaders.cookie must be a string" };
      headers.cookie = rawHeaders.cookie.trim();
    }
    fields.customHeaders = headers;
  }

  if (body.nsfw !== undefined) {
    if (typeof body.nsfw !== "boolean") {
      return { success: false, error: "nsfw must be a boolean" };
    }
    fields.nsfw = body.nsfw;
  }

  if (typeof fields.name === "string" && !fields.name) {
    return { success: false, error: "name cannot be empty" };
  }
  if (typeof fields.logo === "string" && !isHttpUrl(fields.logo)) {
    return { success: false, error: "logo must be an HTTP(S) URL" };
  }
  if (typeof fields.BaseUrl === "string" && !isHttpUrl(fields.BaseUrl)) {
    return { success: false, error: "BaseUrl must be an HTTP(S) URL" };
  }
  if (fields.type !== undefined && !isExtensionType(fields.type)) {
    return { success: false, error: "Invalid type" };
  }
  if (partial && Object.keys(fields).length === 0) {
    return { success: false, error: "At least one editable field is required" };
  }

  return { success: true, data: fields };
}

function failureResponse(error: unknown, operation: string) {
  if (error instanceof FirestoreRestError) {
    if (error.status === 504) {
      return NextResponse.json({ success: false, error: "Firebase request timed out" }, { status: 504 });
    }
    if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 409) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
  }
  console.error(`External extensions API failed to ${operation}`, error);
  return NextResponse.json({ success: false, error: "Firebase service is unavailable" }, { status: 502 });
}

async function getCachedExtensions(ttlSeconds: number) {
  if (ttlSeconds > 0 && cachedExtensions && cachedExtensions.expiresAt > Date.now()) {
    return cachedExtensions.data;
  }

  if (!extensionsRequest) {
    extensionsRequest = listFirestoreDocuments("EXTENSION", 1000);
  }
  try {
    const extensions = await extensionsRequest;
    if (ttlSeconds > 0) {
      cachedExtensions = { data: extensions, expiresAt: Date.now() + ttlSeconds * 1000 };
    } else {
      cachedExtensions = null;
    }
    return extensions;
  } finally {
    extensionsRequest = null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const requestedLimit = searchParams.get("limit");

  if (type && !isExtensionType(type)) {
    return NextResponse.json({ success: false, error: "Invalid type" }, { status: 400 });
  }

  let limit: number | undefined;
  if (requestedLimit !== null) {
    limit = Number(requestedLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: "limit must be an integer from 1 to 100" },
        { status: 400 }
      );
    }
  }

  const authorization = await authorizeExternalApiRequest(request);
  if (!authorization.authorized) return authorization.response;

  try {
    const documents = await getCachedExtensions(authorization.settings.extensionCacheTtlSeconds);
    let extensions = documents.filter((extension) => {
      const active = typeof extension.status === "string"
        ? extension.status !== "inactive"
        : extension.isActive !== false;
      const allowedNsfw = authorization.settings.showNsfw || (extension.nsfw !== true && extension.isNsfw !== true);
      return active && allowedNsfw;
    });

    if (type) extensions = extensions.filter((extension) => extension.type === type);
    const total = extensions.length;
    if (limit !== undefined) extensions = extensions.slice(0, limit);
    const publicExtensions = extensions.map((extension) => {
      const isActive = extension.isActive !== undefined
        ? extension.isActive === true
        : extension.status !== "inactive";
      const baseUrl = typeof extension.baseUrl === "string" && extension.baseUrl
        ? extension.baseUrl
        : typeof extension.BaseUrl === "string" ? extension.BaseUrl : "";
      const mirrorUrls = Array.isArray(extension.mirrorUrls)
        ? extension.mirrorUrls.filter((item): item is string => typeof item === "string")
        : [];
      const customHeaders = isRecord(extension.customHeaders)
        ? {
            referer: typeof extension.customHeaders.referer === "string" ? extension.customHeaders.referer : undefined,
            userAgent: typeof extension.customHeaders.userAgent === "string" ? extension.customHeaders.userAgent : undefined,
            cookie: typeof extension.customHeaders.cookie === "string" ? extension.customHeaders.cookie : undefined,
          }
        : undefined;

      return {
        id: typeof extension.id === "string" ? extension.id : "",
        name: typeof extension.name === "string" ? extension.name : "",
        description: typeof extension.description === "string" ? extension.description : "",
        logo: typeof extension.logo === "string" ? extension.logo : "",
        type: typeof extension.type === "string" ? extension.type : "",
        BaseUrl: baseUrl,
        baseUrl,
        mirrorUrls,
        UrlSearch: typeof extension.UrlSearch === "string" ? extension.UrlSearch : "",
        location: typeof extension.location === "string" ? extension.location : "",
        status: isActive ? "active" : "inactive",
        isActive,
        isVipOnly: extension.isVipOnly === true,
        customHeaders,
        nsfw: extension.nsfw === true || extension.isNsfw === true,
        createdAt: typeof extension.createdAt === "string" ? extension.createdAt : "",
        updatedAt: typeof extension.updatedAt === "string" ? extension.updatedAt : "",
      };
    });

    return NextResponse.json({
      success: true,
      message: "Extensions retrieved",
      total,
      data: publicExtensions,
      ...externalApiMetadata(authorization.settings),
    });
  } catch (error) {
    return failureResponse(error, "retrieve extensions");
  }
}

export async function POST(request: Request) {
  const authorizationError = authorizeAdminApiRequest(request);
  if (authorizationError) return authorizationError;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: "Request body must be an object" }, { status: 400 });
    }
    const validation = toExtensionData(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const id = randomUUID().replace(/-/g, "");
    const data: Record<string, unknown> = {
      ...validation.data,
      description: validation.data.description ?? "",
      UrlSearch: validation.data.UrlSearch ?? "",
      location: validation.data.location ?? "",
      api: validation.data.api ?? "",
      status: validation.data.status ?? "active",
      createdAt: new Date().toISOString(),
    };
    await createFirestoreDocument("EXTENSION", id, data);
    cachedExtensions = null;

    try {
      await recordAdminActivity("Ekstensi ditambahkan via API", String(data.name || id), id);
    } catch (logError) {
      console.error("Failed to log activity for created extension", logError);
    }

    return NextResponse.json({ success: true, id, data: { id, ...data } }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    return failureResponse(error, "create extension");
  }
}

export async function PUT(request: Request) {
  const authorizationError = authorizeAdminApiRequest(request);
  if (authorizationError) return authorizationError;

  const { searchParams } = new URL(request.url);
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: "Request body must be an object" }, { status: 400 });
    }
    const id = searchParams.get("id")?.trim() || (typeof body.id === "string" ? body.id.trim() : "");
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const validation = toExtensionData(body, true);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const existing = await getFirestoreDocument(`EXTENSION/${id}`);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Extension not found" }, { status: 404 });
    }
    await updateFirestoreDocument("EXTENSION", id, {
      ...validation.data,
      updatedAt: new Date().toISOString(),
    });
    cachedExtensions = null;

    try {
      await recordAdminActivity("Ekstensi diperbarui via API", String(existing.name || id), id);
    } catch (logError) {
      console.error("Failed to log activity for updated extension", logError);
    }

    return NextResponse.json({
      success: true,
      id,
      data: { ...existing, ...validation.data, id },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }
    return failureResponse(error, "update extension");
  }
}

export async function DELETE(request: Request) {
  const authorizationError = authorizeAdminApiRequest(request);
  if (authorizationError) return authorizationError;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

  try {
    const existing = await getFirestoreDocument(`EXTENSION/${id}`);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Extension not found" }, { status: 404 });
    }
    await deleteFirestoreDocument("EXTENSION", id);
    cachedExtensions = null;

    try {
      await recordAdminActivity("Ekstensi dihapus via API", String(existing.name || id), id);
    } catch (logError) {
      console.error("Failed to log activity for deleted extension", logError);
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return failureResponse(error, "delete extension");
  }
}
