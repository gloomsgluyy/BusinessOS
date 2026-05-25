import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, isExecutiveRole } from "@/lib/role-access";
import { readDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DOCUMENT_GROUPS = new Set(["required", "critical", "additional"]);
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
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;`);
  shipmentDocumentTableReady = true;
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function canReadShipmentDocs(role: unknown, group: string) {
  const canReadRegular = canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
  if (group === "critical") return canReadRegular && isExecutiveRole(role);
  return canReadRegular;
}

function safeFilePart(value: string, fallback = "document") {
  return cleanText(value, fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || fallback;
}

function zipEntryName(doc: {
  requirementCode: string | null;
  requirementLabel: string | null;
  title: string;
  fileName: string;
}, index: number, seen: Map<string, number>) {
  const code = cleanText(doc.requirementCode || undefined);
  const label = safeFilePart(doc.requirementLabel || doc.title || "document");
  const original = safeFilePart(doc.fileName || "file");
  const base = `${String(index + 1).padStart(2, "0")}${code ? `-${safeFilePart(code)}` : ""}-${label}-${original}`;
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  return count > 1 ? base.replace(/(\.[^.]+)?$/, `-${count}$1`) : base;
}

function attachmentFileName(value: string) {
  return safeFilePart(value, "shipment-documents").replace(/["\r\n]/g, "_");
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureShipmentDocumentTable();

  const url = new URL(req.url);
  const group = cleanText(url.searchParams.get("group") || url.searchParams.get("documentGroup"), "required").toLowerCase();
  if (!DOCUMENT_GROUPS.has(group)) {
    return NextResponse.json({ error: "Invalid document group" }, { status: 400 });
  }
  if (!canReadShipmentDocs(session.user.role, group)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [shipment, docs] = await Promise.all([
    prisma.shipmentDetail.findFirst({
      where: { id: params.id, isDeleted: false },
      select: { nomination: true, bargeName: true, vesselName: true, mvProjectName: true },
    }),
    prisma.shipmentDocument.findMany({
      where: { shipmentId: params.id, documentGroup: group, isDeleted: false },
      orderBy: [{ requirementCode: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        requirementCode: true,
        requirementLabel: true,
        title: true,
        fileName: true,
        data: true,
        storageProvider: true,
        storageKey: true,
      },
    }),
  ]);

  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  if (docs.length === 0) return NextResponse.json({ error: "No documents available" }, { status: 404 });

  const zip = new JSZip();
  const seenNames = new Map<string, number>();
  await Promise.all(docs.map(async (doc, index) => {
    const fileBuffer = await readDocumentObject({
      provider: doc.storageProvider,
      key: doc.storageKey,
      data: doc.data,
    });
    zip.file(zipEntryName(doc, index, seenNames), fileBuffer);
  }));

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  const shipmentName = cleanText(shipment.nomination || shipment.bargeName || shipment.vesselName || shipment.mvProjectName || params.id, params.id);
  const filename = `${group}-documents-${attachmentFileName(shipmentName)}.zip`;
  const body = zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zipBuffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
