import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole, isExecutiveRole } from "@/lib/role-access";
import { storeDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOCUMENT_GROUPS = new Set(["required", "critical", "additional"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_REQUIRED_DOCUMENTS = [
  { code: "a", label: "COPY OF LAPORAN HASIL VERIFIKASI", ownerRole: "Traffic" },
  { code: "b", label: "1 ORIGINAL DRAUGHT SURVEY REPORT", ownerRole: "Traffic" },
  { code: "c", label: "1 ORIGINAL SURAT KETERANGAN ASAL BARANG", ownerRole: "Traffic" },
  { code: "d", label: "1 ORIGINAL SURAT KEBENARAN DOKUMEN", ownerRole: "Traffic" },
  { code: "e", label: "1 ORIGINAL SURAT KIRIM BARANG", ownerRole: "Traffic" },
  { code: "f", label: "1 ORIGINAL BUKTI BAYAR ROYALTI", ownerRole: "Traffic" },
  { code: "g", label: "3/3 ORIGINAL BILL OF LADING ISSUED BY LOADPORT AGENT", ownerRole: "Traffic" },
  { code: "h", label: "3/3 COPIES NON NEGOTIABLE BILL OF LADING ISSUED BY LOADPORT AGENT", ownerRole: "Traffic" },
  { code: "i", label: "1 ORIGINAL AND 4 COPIES OF CERTIFICATE OF SAMPLING AND ANALYSIS ISSUED BY INDEPENDENT SURVEYOR AT LOADING PORT (IF ANY)", ownerRole: "Quality/Traffic" },
  { code: "j", label: "1 ORIGINAL AND 4 COPIES OF CERTIFICATE OF WEIGHT ISSUED BY INDEPENDENT SURVEYOR AT LOADING PORT (IF ANY)", ownerRole: "Quality/Traffic" },
  { code: "k", label: "1 ORIGINAL AND 2 COPIES OF CERTIFICATE OF DRAUGHT SURVEY REPORT BY INDEPENDENT SURVEYOR AT LOADING PORT", ownerRole: "Traffic" },
];
const CHECKLIST_STATUSES = new Set(["pending", "received", "submitted", "completed", "not_required", "rejected", "superseded"]);
let shipmentDocumentTableReady = false;

async function ensureShipmentDocumentTable() {
  if (shipmentDocumentTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShipmentDocument" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "documentGroup" TEXT NOT NULL,
      "requirementCode" TEXT,
      "requirementLabel" TEXT,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "notes" TEXT,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT,
      "sizeBytes" INTEGER NOT NULL DEFAULT 0,
      "data" BYTEA NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "parentDocumentId" TEXT,
      "replacedByDocumentId" TEXT,
      "replacementReason" TEXT,
      "replacedAt" TIMESTAMP(3),
      "replacedBy" TEXT,
      "replacedByName" TEXT,
      "uploadedBy" TEXT,
      "uploadedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShipmentDocument_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "parentDocumentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "replacedByDocumentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "replacementReason" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "replacedAt" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "replacedBy" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "replacedByName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocument_shipmentId_idx" ON "ShipmentDocument"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocument_shipmentId_documentGroup_idx" ON "ShipmentDocument"("shipmentId", "documentGroup");`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShipmentDocumentChecklistItem" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "documentGroup" TEXT NOT NULL DEFAULT 'required',
      "requirementCode" TEXT,
      "requirementLabel" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "required" BOOLEAN NOT NULL DEFAULT true,
      "ownerRole" TEXT,
      "responsibleParty" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "expectedDate" TIMESTAMP(3),
      "receivedDate" TIMESTAMP(3),
      "submittedDate" TIMESTAMP(3),
      "submittedTo" TEXT,
      "hardcopyStatus" TEXT,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShipmentDocumentChecklistItem_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocumentChecklistItem_shipmentId_idx" ON "ShipmentDocumentChecklistItem"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocumentChecklistItem_shipmentId_documentGroup_idx" ON "ShipmentDocumentChecklistItem"("shipmentId", "documentGroup");`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentDocumentChecklistItem_required_code_uidx" ON "ShipmentDocumentChecklistItem"("shipmentId", "documentGroup", "requirementCode") WHERE "requirementCode" IS NOT NULL;`);
  shipmentDocumentTableReady = true;
}

function canReadShipmentDocs(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
}

function canWriteShipmentDocs(role: unknown, group: string) {
  if (group === "critical") return isExecutiveRole(role);
  return canWriteModuleForRole(role, "OPERATIONS_TRAFFIC") || canWriteModuleForRole(role, "PL_SALES");
}

function cleanText(value: FormDataEntryValue | string | null, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "shipment-document";
}

function parseDate(value: unknown) {
  if (value === undefined) return undefined;
  const text = cleanText(String(value || ""));
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
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
    shipmentId: true,
    documentGroup: true,
    requirementCode: true,
    requirementLabel: true,
    title: true,
    status: true,
    notes: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
    storageProvider: true,
    storageKey: true,
    storageUrl: true,
    version: true,
    parentDocumentId: true,
    replacedByDocumentId: true,
    replacementReason: true,
    replacedAt: true,
    replacedBy: true,
    replacedByName: true,
    uploadedBy: true,
    uploadedByName: true,
    createdAt: true,
    updatedAt: true,
  };
}

function checklistSelect() {
  return {
    id: true,
    shipmentId: true,
    documentGroup: true,
    requirementCode: true,
    requirementLabel: true,
    title: true,
    required: true,
    ownerRole: true,
    responsibleParty: true,
    status: true,
    expectedDate: true,
    receivedDate: true,
    submittedDate: true,
    submittedTo: true,
    hardcopyStatus: true,
    notes: true,
    createdBy: true,
    createdByName: true,
    createdAt: true,
    updatedAt: true,
  };
}

async function ensureDefaultRequiredChecklist(shipmentId: string) {
  await prisma.shipmentDocumentChecklistItem.createMany({
    data: DEFAULT_REQUIRED_DOCUMENTS.map((item) => ({
      shipmentId,
      documentGroup: "required",
      requirementCode: item.code,
      requirementLabel: item.label,
      title: item.label,
      required: true,
      ownerRole: item.ownerRole,
      status: "pending",
    })),
    skipDuplicates: true,
  });
}

async function syncChecklistForUpload(params: {
  shipmentId: string;
  documentGroup: string;
  requirementCode: string | null;
  requirementLabel: string | null;
  title: string;
  status: string;
  userId?: string | null;
  userName?: string | null;
}) {
  const status = CHECKLIST_STATUSES.has(params.status) ? params.status : "received";
  const nextStatus = status === "pending" ? "received" : status;
  const baseData = {
    requirementLabel: params.requirementLabel || params.title,
    title: params.requirementLabel || params.title,
    required: params.documentGroup === "required",
    status: nextStatus,
    receivedDate: nextStatus === "received" || nextStatus === "submitted" || nextStatus === "completed" ? new Date() : undefined,
    createdBy: params.userId || null,
    createdByName: params.userName || null,
  };

  if (params.requirementCode) {
    return prisma.shipmentDocumentChecklistItem.upsert({
      where: {
        shipmentId_documentGroup_requirementCode: {
          shipmentId: params.shipmentId,
          documentGroup: params.documentGroup,
          requirementCode: params.requirementCode,
        },
      },
      create: {
        shipmentId: params.shipmentId,
        documentGroup: params.documentGroup,
        requirementCode: params.requirementCode,
        ...baseData,
      },
      update: {
        requirementLabel: baseData.requirementLabel,
        title: baseData.title,
        status: nextStatus,
        receivedDate: baseData.receivedDate,
      },
      select: checklistSelect(),
    });
  }

  return prisma.shipmentDocumentChecklistItem.create({
    data: {
      shipmentId: params.shipmentId,
      documentGroup: params.documentGroup,
      requirementCode: null,
      ...baseData,
    },
    select: checklistSelect(),
  });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadShipmentDocs(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureShipmentDocumentTable();

  const url = new URL(req.url);
  const requestedGroup = cleanText(url.searchParams.get("group"));
  if (requestedGroup && !DOCUMENT_GROUPS.has(requestedGroup)) {
    return NextResponse.json({ error: "Invalid document group" }, { status: 400 });
  }
  if (requestedGroup === "critical" && !isExecutiveRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canReadCritical = isExecutiveRole(session.user.role);
  await ensureDefaultRequiredChecklist(params.id);
  const docs = await prisma.shipmentDocument.findMany({
    where: {
      shipmentId: params.id,
      isDeleted: false,
      ...(requestedGroup
        ? { documentGroup: requestedGroup }
        : canReadCritical
          ? {}
          : { documentGroup: { not: "critical" } }),
    },
    orderBy: [{ documentGroup: "asc" }, { createdAt: "desc" }],
    select: docSelect(),
  });
  const checklistItems = await prisma.shipmentDocumentChecklistItem.findMany({
    where: {
      shipmentId: params.id,
      isDeleted: false,
      ...(requestedGroup
        ? { documentGroup: requestedGroup }
        : canReadCritical
          ? {}
          : { documentGroup: { not: "critical" } }),
    },
    orderBy: [{ documentGroup: "asc" }, { requirementCode: "asc" }, { createdAt: "asc" }],
    select: checklistSelect(),
  });
  const docCountByRequirement = docs.reduce<Record<string, number>>((acc, doc) => {
    const key = `${doc.documentGroup}:${doc.requirementCode || doc.title}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    documents: docs.map((doc) => ({
      ...doc,
      url: `/api/shipments/${params.id}/documents/${doc.id}`,
    })),
    checklistItems: checklistItems.map((item) => ({
      ...item,
      documentCount: docCountByRequirement[`${item.documentGroup}:${item.requirementCode || item.title}`] || 0,
    })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureShipmentDocumentTable();

  const shipment = await prisma.shipmentDetail.findUnique({ where: { id: params.id } });
  if (!shipment || shipment.isDeleted) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const group = cleanText(formData.get("documentGroup"), "additional").toLowerCase();
  const requirementCode = cleanText(formData.get("requirementCode")) || null;
  const requirementLabel = cleanText(formData.get("requirementLabel")) || null;
  const title = cleanText(formData.get("title"), requirementLabel || "Shipment document");
  const status = cleanText(formData.get("status"), "draft").toLowerCase();
  const notes = cleanText(formData.get("notes")) || null;

  if (!DOCUMENT_GROUPS.has(group)) return NextResponse.json({ error: "Invalid document group" }, { status: 400 });
  if (!canWriteShipmentDocs(session.user.role, group)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  if (!isAllowedFile(file)) {
    return NextResponse.json({ error: "Only images, PDF, and DOCX files are allowed" }, { status: 400 });
  }

  const replacementTarget = group === "critical"
    ? await prisma.shipmentDocument.findFirst({
      where: {
        shipmentId: params.id,
        documentGroup: "critical",
        title,
        isDeleted: false,
        replacedByDocumentId: null,
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      select: { id: true, version: true, parentDocumentId: true },
    })
    : null;

  const storedFile = await storeDocumentObject({
    scope: "shipment",
    ownerId: params.id,
    fileName: file.name || "shipment-document",
    mimeType: file.type || "application/octet-stream",
    buffer,
  });

  const doc = await prisma.shipmentDocument.create({
    data: {
      shipmentId: params.id,
      documentGroup: group,
      requirementCode,
      requirementLabel,
      title,
      status,
      notes,
      fileName: sanitizeFileName(file.name || "shipment-document"),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      data: storedFile.data,
      storageProvider: storedFile.provider,
      storageKey: storedFile.key,
      storageUrl: storedFile.url,
      version: replacementTarget ? replacementTarget.version + 1 : 1,
      parentDocumentId: replacementTarget?.parentDocumentId || replacementTarget?.id || null,
      replacementReason: replacementTarget
        ? (notes || "Critical document replaced by a newer upload with the same title.")
        : null,
      uploadedBy: session.user.id,
      uploadedByName: session.user.name || session.user.email || null,
    },
    select: docSelect(),
  });
  if (replacementTarget) {
    await prisma.shipmentDocument.update({
      where: { id: replacementTarget.id },
      data: {
        status: "superseded",
        replacedByDocumentId: doc.id,
        replacementReason: doc.replacementReason || "Critical document replaced by a newer upload with the same title.",
        replacedAt: new Date(),
        replacedBy: session.user.id,
        replacedByName: session.user.name || session.user.email || null,
      },
    });
  }
  const checklistItem = await syncChecklistForUpload({
    shipmentId: params.id,
    documentGroup: group,
    requirementCode,
    requirementLabel,
    title,
    status,
    userId: session.user.id,
    userName: session.user.name || session.user.email || null,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_DOCUMENT_UPLOAD",
      entity: "ShipmentDocument",
      entityId: doc.id,
      details: JSON.stringify({ shipmentId: params.id, group, title, fileName: doc.fileName, sizeBytes: doc.sizeBytes, version: doc.version, replacedDocumentId: replacementTarget?.id || null }),
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    document: { ...doc, url: `/api/shipments/${params.id}/documents/${doc.id}` },
    checklistItem: { ...checklistItem, documentCount: 1 },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureShipmentDocumentTable();

  const data = await req.json();
  const group = cleanText(data.documentGroup, "required").toLowerCase();
  const requirementCode = cleanText(data.requirementCode) || null;
  const requirementLabel = cleanText(data.requirementLabel || data.title, "Shipment document");
  const title = cleanText(data.title, requirementLabel);
  const status = cleanText(data.status, "pending").toLowerCase();

  if (!DOCUMENT_GROUPS.has(group)) return NextResponse.json({ error: "Invalid document group" }, { status: 400 });
  if (!CHECKLIST_STATUSES.has(status)) return NextResponse.json({ error: "Invalid checklist status" }, { status: 400 });
  if (!canWriteShipmentDocs(session.user.role, group)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existingItem = data.id
    ? await prisma.shipmentDocumentChecklistItem.findFirst({
      where: { id: cleanText(data.id), shipmentId: params.id, isDeleted: false },
      select: { id: true, documentGroup: true },
    })
    : null;
  if (data.id && !existingItem) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
  if (existingItem && !canWriteShipmentDocs(session.user.role, existingItem.documentGroup)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData = {
    requirementLabel,
    title,
    status,
    required: data.required !== undefined ? Boolean(data.required) : group === "required",
    ownerRole: data.ownerRole !== undefined ? (cleanText(data.ownerRole) || null) : undefined,
    responsibleParty: data.responsibleParty !== undefined ? (cleanText(data.responsibleParty) || null) : undefined,
    expectedDate: parseDate(data.expectedDate),
    receivedDate: data.receivedDate !== undefined
      ? parseDate(data.receivedDate)
      : ["received", "submitted", "completed"].includes(status)
        ? new Date()
        : undefined,
    submittedDate: data.submittedDate !== undefined
      ? parseDate(data.submittedDate)
      : ["submitted", "completed"].includes(status)
        ? new Date()
        : undefined,
    submittedTo: data.submittedTo !== undefined ? (cleanText(data.submittedTo) || null) : undefined,
    hardcopyStatus: data.hardcopyStatus !== undefined ? (cleanText(data.hardcopyStatus) || null) : undefined,
    notes: data.notes !== undefined ? (cleanText(data.notes) || null) : undefined,
    updatedAt: new Date(),
  };

  const item = data.id
    ? await prisma.shipmentDocumentChecklistItem.update({
      where: { id: existingItem!.id },
      data: updateData,
      select: checklistSelect(),
    })
    : await prisma.shipmentDocumentChecklistItem.upsert({
      where: {
        shipmentId_documentGroup_requirementCode: {
          shipmentId: params.id,
          documentGroup: group,
          requirementCode: requirementCode || title,
        },
      },
      create: {
        shipmentId: params.id,
        documentGroup: group,
        requirementCode: requirementCode || null,
        ...updateData,
        createdBy: session.user.id,
        createdByName: session.user.name || session.user.email || null,
      },
      update: updateData,
      select: checklistSelect(),
    });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_DOCUMENT_CHECKLIST_UPDATE",
      entity: "ShipmentDocumentChecklistItem",
      entityId: item.id,
      details: JSON.stringify({ shipmentId: params.id, group, requirementCode, title, status }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, checklistItem: item }, {
    headers: { "Cache-Control": "no-store" },
  });
}
