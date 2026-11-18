import { firebaseConfig } from "@/lib/firebase";

type FirestoreRestValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  referenceValue?: string;
  arrayValue?: { values?: FirestoreRestValue[] };
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
};

type FirestoreRestDocument = {
  name: string;
  fields?: Record<string, FirestoreRestValue>;
};

export class FirestoreRestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "FirestoreRestError";
  }
}

const firestoreDocumentsUrl =
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId ?? "")}` +
  "/databases/(default)/documents";

function documentUrl(path: string, params = new URLSearchParams()): string {
  params.set("key", firebaseConfig.apiKey);
  return `${firestoreDocumentsUrl}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?${params.toString()}`;
}

function decodeValue(value: FirestoreRestValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("arrayValue" in value) return (value.arrayValue?.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, FirestoreRestValue>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [field, decodeValue(value)])
  );
}

function decodeDocument(document: FirestoreRestDocument) {
  const id = document.name.split("/").pop() ?? "";
  return { ...decodeFields(document.fields ?? {}), id };
}

function encodeValue(value: unknown): FirestoreRestValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([field, fieldValue]) => [field, encodeValue(fieldValue)])
        ),
      },
    };
  }
  throw new TypeError("Unsupported Firestore field value");
}

function encodeFields(fields: Record<string, unknown>) {
  return {
    fields: Object.fromEntries(
      Object.entries(fields).map(([field, value]) => [field, encodeValue(value)])
    ),
  };
}

async function requestFirestore(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
    if (!response.ok) {
      let message = `Firestore REST request failed (${response.status})`;
      try {
        const body: unknown = await response.json();
        if (
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
        ) {
          message = body.error.message;
        }
      } catch {
        // Keep the status-based message when the error body is not JSON.
      }
      throw new FirestoreRestError(message, response.status);
    }
    return response;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FirestoreRestError("Firestore REST request timed out", 504);
    }
    if (error instanceof FirestoreRestError) throw error;
    throw new FirestoreRestError("Firestore REST service is unavailable", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFirestoreDocument(path: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await requestFirestore(documentUrl(path));
    const document = (await response.json()) as FirestoreRestDocument;
    return decodeDocument(document);
  } catch (error) {
    if (error instanceof FirestoreRestError && error.status === 404) return null;
    throw error;
  }
}

export async function listFirestoreDocuments(
  collectionName: string,
  maxDocuments = 10000
): Promise<Array<Record<string, unknown>>> {
  const documents: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: String(Math.min(1000, maxDocuments - documents.length)),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await requestFirestore(documentUrl(collectionName, params));
    const result = (await response.json()) as {
      documents?: FirestoreRestDocument[];
      nextPageToken?: string;
    };
    documents.push(...(result.documents ?? []).map(decodeDocument));
    pageToken = result.nextPageToken;
  } while (pageToken && documents.length < maxDocuments);

  return documents;
}

export async function queryFirestoreDocuments(
  collectionName: string,
  fieldPath: string,
  value: unknown,
  limit = 100
): Promise<Array<Record<string, unknown>>> {
  const queryUrl = new URL(`${firestoreDocumentsUrl}:runQuery`);
  queryUrl.searchParams.set("key", firebaseConfig.apiKey);
  const response = await requestFirestore(
    queryUrl.toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: "EQUAL",
              value: encodeValue(value),
            },
          },
          limit,
        },
      }),
    }
  );
  const result = (await response.json()) as Array<{ document?: FirestoreRestDocument }>;
  return result.flatMap((item) => (item.document ? [decodeDocument(item.document)] : []));
}

export async function createFirestoreDocument(
  collectionName: string,
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const params = new URLSearchParams({ documentId: id });
  const response = await requestFirestore(documentUrl(collectionName, params), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encodeFields(fields)),
  });
  await response.body?.cancel();
}

export async function updateFirestoreDocument(
  collectionName: string,
  id: string,
  fields: Record<string, unknown>
): Promise<void> {
  const params = new URLSearchParams();
  for (const field of Object.keys(fields)) params.append("updateMask.fieldPaths", field);
  const response = await requestFirestore(documentUrl(`${collectionName}/${id}`, params), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encodeFields(fields)),
  });
  await response.body?.cancel();
}

export async function deleteFirestoreDocument(collectionName: string, id: string): Promise<void> {
  const response = await requestFirestore(documentUrl(`${collectionName}/${id}`), {
    method: "DELETE",
  });
  await response.body?.cancel();
}
