import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole } from "@/lib/role-access";
import { readDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function contentDispositionFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

export async function GET(_req: Request, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadDailyDelivery(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureDailyDeliveryDocumentTable();

  const doc = await prisma.dailyDeliveryDocument.findFirst({
    where: { id: params.docId, dailyDeliveryId: params.id, isDeleted: false },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

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

export async function DELETE(_req: Request, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteDailyDelivery(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureDailyDeliveryDocumentTable();

  const doc = await prisma.dailyDeliveryDocument.findFirst({
    where: { id: params.docId, dailyDeliveryId: params.id, isDeleted: false },
    select: { id: true, documentType: true, title: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.dailyDeliveryDocument.update({
    where: { id: params.docId },
    data: { isDeleted: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "DAILY_DELIVERY_DOCUMENT_DELETE",
      entity: "DailyDeliveryDocument",
      entityId: doc.id,
      details: JSON.stringify({ dailyDeliveryId: params.id, documentType: doc.documentType, title: doc.title }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
