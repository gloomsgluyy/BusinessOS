import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole, isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";

const DOCUMENT_GROUPS = new Set(["required", "critical", "additional"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function ensureShipmentDocumentTable() {
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
      "uploadedBy" TEXT,
      "uploadedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShipmentDocument_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocument_shipmentId_idx" ON "ShipmentDocument"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocument_shipmentId_documentGroup_idx" ON "ShipmentDocument"("shipmentId", "documentGroup");`);
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
    uploadedBy: true,
    uploadedByName: true,
    createdAt: true,
    updatedAt: true,
  };
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

  return NextResponse.json({
    success: true,
    documents: docs.map((doc) => ({
      ...doc,
      url: `/api/shipments/${params.id}/documents/${doc.id}`,
    })),
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
      data: buffer,
      uploadedBy: session.user.id,
      uploadedByName: session.user.name || session.user.email || null,
    },
    select: docSelect(),
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_DOCUMENT_UPLOAD",
      entity: "ShipmentDocument",
      entityId: doc.id,
      details: JSON.stringify({ shipmentId: params.id, group, title, fileName: doc.fileName, sizeBytes: doc.sizeBytes }),
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    document: { ...doc, url: `/api/shipments/${params.id}/documents/${doc.id}` },
  });
}
