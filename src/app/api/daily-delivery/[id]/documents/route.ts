import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole } from "@/lib/role-access";
import { storeDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(["skab", "dsr", "bl_cm", "coa_pol", "coa_pod", "full_set", "hardcopy", "softcopy", "other"]);
const EVIDENCE_FIELD_BY_TYPE: Record<string, string | undefined> = {
  skab: "skabEvidenceDocumentId",
  dsr: "dsrEvidenceDocumentId",
  bl_cm: "blCmEvidenceDocumentId",
  coa_pol: "coaPolEvidenceDocumentId",
  coa_pod: "coaPodEvidenceDocumentId",
};

let tableReady = false;

async function ensureDailyDeliveryDocumentTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyDeliveryDocument" (
      "id" TEXT NOT NULL,
      "dailyDeliveryId" TEXT NOT NULL,
      "documentType" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT,
      "sizeBytes" INTEGER NOT NULL DEFAULT 0,
      "data" BYTEA NOT NULL,
      "storageProvider" TEXT,
      "storageKey" TEXT,
      "storageUrl" TEXT,
      "uploadedBy" TEXT,
      "uploadedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "DailyDeliveryDocument_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DailyDeliveryDocument_dailyDeliveryId_idx" ON "DailyDeliveryDocument"("dailyDeliveryId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DailyDeliveryDocument_dailyDeliveryId_documentType_idx" ON "DailyDeliveryDocument"("dailyDeliveryId", "documentType");`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DailyDeliveryDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DailyDeliveryDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DailyDeliveryDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;`);
  tableReady = true;
}

function canReadDailyDelivery(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
}

function canWriteDailyDelivery(role: unknown) {
  return canWriteModuleForRole(role, "OPERATIONS_TRAFFIC") || canWriteModuleForRole(role, "PL_SALES");
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "daily-delivery-document";
}

function isAllowedFile(file: File) {
  const name = (file.name || "").toLowerCase();
  const extAllowed = /\.(pdf|docx|jpe?g|png|webp|gif)$/i.test(name);
  const mime = (file.type || "").toLowerCase();
  const mimeAllowed =
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/octet-stream";
  return extAllowed && (!mime || mimeAllowed);
}

function docSelect() {
  return {
    id: true,
    dailyDeliveryId: true,
    documentType: true,
    title: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
    storageProvider: true,
    storageKey: true,
    storageUrl: true,
    uploadedBy: true,
    uploadedByName: true,
    createdAt: true,
    updatedAt: true,
    isDeleted: true,
  };
}

function withUrl(doc: any) {
  return { ...doc, url: `/api/daily-delivery/${doc.dailyDeliveryId}/documents/${doc.id}` };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadDailyDelivery(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureDailyDeliveryDocumentTable();

  const delivery = await prisma.dailyDelivery.findFirst({
    where: { id: params.id, isDeleted: false },
    select: { id: true },
  });
  if (!delivery) return NextResponse.json({ error: "Daily delivery record not found" }, { status: 404 });

  const documents = await prisma.dailyDeliveryDocument.findMany({
    where: { dailyDeliveryId: params.id, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: docSelect(),
  });

  return NextResponse.json({ success: true, documents: documents.map(withUrl) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteDailyDelivery(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureDailyDeliveryDocumentTable();

  const delivery = await prisma.dailyDelivery.findFirst({
    where: { id: params.id, isDeleted: false },
    select: { id: true },
  });
  if (!delivery) return NextResponse.json({ error: "Daily delivery record not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File size must be <= 10MB" }, { status: 400 });
  if (!isAllowedFile(file)) return NextResponse.json({ error: "Only image, PDF, and DOCX files are allowed" }, { status: 400 });

  const requestedType = cleanText(form.get("documentType"), "other").toLowerCase();
  const documentType = DOCUMENT_TYPES.has(requestedType) ? requestedType : "other";
  const title = cleanText(form.get("title"), documentType.replace(/_/g, " ").toUpperCase());
  const bytes = Buffer.from(await file.arrayBuffer());
  const storedFile = await storeDocumentObject({
    scope: "daily-delivery",
    ownerId: params.id,
    fileName: file.name || "daily-delivery-document",
    mimeType: file.type || "application/octet-stream",
    buffer: bytes,
  });

  const doc = await prisma.dailyDeliveryDocument.create({
    data: {
      dailyDeliveryId: params.id,
      documentType,
      title,
      fileName: sanitizeFileName(file.name),
      mimeType: file.type || null,
      sizeBytes: file.size,
      data: storedFile.data,
      storageProvider: storedFile.provider,
      storageKey: storedFile.key,
      storageUrl: storedFile.url,
      uploadedBy: session.user.id,
      uploadedByName: session.user.name || session.user.email || "User",
    },
    select: docSelect(),
  });

  const evidenceField = EVIDENCE_FIELD_BY_TYPE[documentType];
  if (evidenceField) {
    await prisma.dailyDelivery.update({
      where: { id: params.id },
      data: { [evidenceField]: doc.id } as any,
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "DAILY_DELIVERY_DOCUMENT_UPLOAD",
      entity: "DailyDeliveryDocument",
      entityId: doc.id,
      details: JSON.stringify({ dailyDeliveryId: params.id, documentType, title, fileName: doc.fileName }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, document: withUrl(doc), evidenceField: evidenceField || null });
}
