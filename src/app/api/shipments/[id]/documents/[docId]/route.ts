import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole, isExecutiveRole } from "@/lib/role-access";
import { readDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  shipmentDocumentTableReady = true;
}

function canReadShipmentDocs(role: unknown, group: string) {
  const canReadRegular = canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
  if (group === "critical") return canReadRegular && isExecutiveRole(role);
  return canReadRegular;
}

function canWriteShipmentDocs(role: unknown, group: string) {
  if (group === "critical") return isExecutiveRole(role);
  return canWriteModuleForRole(role, "OPERATIONS_TRAFFIC") || canWriteModuleForRole(role, "PL_SALES");
}

function contentDispositionFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
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

export async function GET(_req: Request, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureShipmentDocumentTable();

  const doc = await prisma.shipmentDocument.findFirst({
    where: { id: params.docId, shipmentId: params.id, isDeleted: false },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!canReadShipmentDocs(session.user.role, doc.documentGroup)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fileBuffer = await readDocumentObject({
    provider: doc.storageProvider,
    key: doc.storageKey,
    data: doc.data,
  });

  const body = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(doc.sizeBytes || fileBuffer.length),
      "Content-Disposition": `inline; filename="${contentDispositionFileName(doc.fileName)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function PUT(req: Request, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureShipmentDocumentTable();

  const existing = await prisma.shipmentDocument.findFirst({
    where: { id: params.docId, shipmentId: params.id, isDeleted: false },
    select: { id: true, documentGroup: true, status: true, replacedByDocumentId: true },
  });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!canWriteShipmentDocs(session.user.role, existing.documentGroup)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (existing.documentGroup === "critical" && existing.replacedByDocumentId) {
    return NextResponse.json({ error: "Superseded critical document metadata cannot be edited" }, { status: 409 });
  }

  const data = await req.json();
  const doc = await prisma.shipmentDocument.update({
    where: { id: params.docId },
    data: {
      title: data.title !== undefined ? cleanText(data.title, "Shipment document") : undefined,
      status: data.status !== undefined ? cleanText(data.status, "draft").toLowerCase() : undefined,
      notes: data.notes !== undefined ? (cleanText(data.notes) || null) : undefined,
      requirementCode: data.requirementCode !== undefined ? (cleanText(data.requirementCode) || null) : undefined,
      requirementLabel: data.requirementLabel !== undefined ? (cleanText(data.requirementLabel) || null) : undefined,
      updatedAt: new Date(),
    },
    select: docSelect(),
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_DOCUMENT_UPDATE",
      entity: "ShipmentDocument",
      entityId: doc.id,
      details: JSON.stringify({ shipmentId: params.id, title: doc.title, status: doc.status }),
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    document: { ...doc, url: `/api/shipments/${params.id}/documents/${doc.id}` },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureShipmentDocumentTable();

  const existing = await prisma.shipmentDocument.findFirst({
    where: { id: params.docId, shipmentId: params.id, isDeleted: false },
    select: { id: true, documentGroup: true },
  });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!canWriteShipmentDocs(session.user.role, existing.documentGroup)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.shipmentDocument.update({
    where: { id: params.docId },
    data: { isDeleted: true, updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_DOCUMENT_DELETE",
      entity: "ShipmentDocument",
      entityId: params.docId,
      details: JSON.stringify({ shipmentId: params.id }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
