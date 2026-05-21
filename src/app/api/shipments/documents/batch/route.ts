import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  shipmentDocumentTableReady = true;
}

function canReadShipmentDocs(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
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

function timingHeader(timings: Record<string, number>) {
  return Object.entries(timings)
    .map(([key, value]) => `${key};dur=${Math.max(0, Math.round(value))}`)
    .join(", ");
}

export async function POST(req: Request) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();
  const authStartedAt = Date.now();
  const session = await getServerSession(authOptions);
  const authMs = Date.now() - authStartedAt;
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadShipmentDocs(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parseStartedAt = Date.now();
  const body = await req.json().catch(() => ({}));
  const shipmentIds: string[] = Array.from(new Set<string>(
    (Array.isArray(body.shipmentIds) ? body.shipmentIds : [])
      .map((id: unknown) => String(id || "").trim())
      .filter(Boolean),
  )).slice(0, 200);
  const requestedGroup = String(body.group || "required").trim().toLowerCase();
  const parseMs = Date.now() - parseStartedAt;

  if (!shipmentIds.length) {
    return NextResponse.json({ success: true, documents: [], documentsByShipment: {} }, {
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": timingHeader({ auth: authMs, parse: parseMs, total: Date.now() - startedAt }),
        "X-BOS-Doc-Trace": `id=${traceId};shipments=0;docs=0;totalMs=${Date.now() - startedAt}`,
      },
    });
  }
  if (!DOCUMENT_GROUPS.has(requestedGroup)) {
    return NextResponse.json({ error: "Invalid document group" }, { status: 400 });
  }
  if (requestedGroup === "critical" && !isExecutiveRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ensureStartedAt = Date.now();
  await ensureShipmentDocumentTable();
  const ensureMs = Date.now() - ensureStartedAt;

  const queryStartedAt = Date.now();
  const docs = await prisma.shipmentDocument.findMany({
    where: {
      shipmentId: { in: shipmentIds },
      documentGroup: requestedGroup,
      isDeleted: false,
    },
    orderBy: [{ shipmentId: "asc" }, { createdAt: "desc" }],
    select: docSelect(),
  });
  const queryMs = Date.now() - queryStartedAt;

  const serializeStartedAt = Date.now();
  const documents = docs.map((doc) => ({
    ...doc,
    url: `/api/shipments/${doc.shipmentId}/documents/${doc.id}`,
  }));
  const documentsByShipment = documents.reduce<Record<string, typeof documents>>((acc, doc) => {
    acc[doc.shipmentId] = [...(acc[doc.shipmentId] || []), doc];
    return acc;
  }, {});
  const serializeMs = Date.now() - serializeStartedAt;
  const totalMs = Date.now() - startedAt;

  console.info("[shipment-docs-batch]", {
    traceId,
    group: requestedGroup,
    shipmentCount: shipmentIds.length,
    docCount: documents.length,
    authMs,
    parseMs,
    ensureMs,
    queryMs,
    serializeMs,
    totalMs,
  });

  return NextResponse.json({ success: true, documents, documentsByShipment }, {
    headers: {
      "Cache-Control": "no-store",
      "Server-Timing": timingHeader({
        auth: authMs,
        parse: parseMs,
        ensure: ensureMs,
        query: queryMs,
        serialize: serializeMs,
        total: totalMs,
      }),
      "X-BOS-Doc-Trace": `id=${traceId};shipments=${shipmentIds.length};docs=${documents.length};authMs=${authMs};ensureMs=${ensureMs};queryMs=${queryMs};totalMs=${totalMs}`,
    },
  });
}
