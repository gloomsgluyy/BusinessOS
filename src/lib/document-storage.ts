import crypto from "crypto";

export type StoredDocumentObject = {
  provider: "database" | "supabase";
  key: string | null;
  url: string | null;
  data: Buffer;
};

type StoreInput = {
  scope: "project" | "shipment" | "daily-delivery";
  ownerId: string;
  fileName: string;
  mimeType?: string | null;
  buffer: Buffer;
};

type ReadInput = {
  provider?: string | null;
  key?: string | null;
  data?: Buffer | Uint8Array | null;
};

function cleanPathPart(value: string) {
  return value
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "file";
}

function supabaseStorageConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || process.env.DOCUMENT_STORAGE_BUCKET || "coaltrade-documents";
  if (!url || !key || !bucket) return null;
  return {
    url: url.replace(/\/+$/, ""),
    key,
    bucket,
  };
}

function shouldUseSupabaseStorage() {
  const provider = String(process.env.DOCUMENT_STORAGE_PROVIDER || "").toLowerCase();
  return provider === "supabase" || Boolean(provider === "" && supabaseStorageConfig());
}

function objectKey(input: StoreInput) {
  const id = crypto.randomUUID();
  const ext = cleanPathPart(input.fileName).match(/\.[^.]+$/)?.[0] || "";
  const base = cleanPathPart(input.fileName).replace(/\.[^.]+$/, "");
  return `${input.scope}/${cleanPathPart(input.ownerId)}/${id}-${base}${ext}`.slice(0, 700);
}

function bufferBody(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function uploadToSupabase(input: StoreInput): Promise<StoredDocumentObject | null> {
  if (!shouldUseSupabaseStorage()) return null;
  const config = supabaseStorageConfig();
  if (!config) return null;

  const key = objectKey(input);
  const res = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": input.mimeType || "application/octet-stream",
      "x-upsert": "false",
    },
    body: bufferBody(input.buffer),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase storage upload failed (${res.status}): ${detail.slice(0, 240)}`);
  }

  return {
    provider: "supabase",
    key,
    url: `${config.url}/storage/v1/object/${config.bucket}/${key}`,
    data: Buffer.alloc(0),
  };
}

export async function storeDocumentObject(input: StoreInput): Promise<StoredDocumentObject> {
  const external = await uploadToSupabase(input);
  if (external) return external;
  return {
    provider: "database",
    key: null,
    url: null,
    data: input.buffer,
  };
}

export async function readDocumentObject(input: ReadInput): Promise<Buffer> {
  if (input.provider === "supabase" && input.key) {
    const config = supabaseStorageConfig();
    if (!config) throw new Error("Supabase storage is not configured");
    const res = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${input.key.split("/").map(encodeURIComponent).join("/")}`, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Supabase storage read failed (${res.status}): ${detail.slice(0, 240)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  return Buffer.from(input.data || []);
}
