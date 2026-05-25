import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isExecutiveRole } from "@/lib/role-access";
import { readDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function contentDispositionFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

async function tableExists(table: string) {
  const safeTable = table.replace(/"/g, "");
  const rows = await prisma.$queryRawUnsafe<Array<{ reg: string | null }>>(
    `SELECT to_regclass('public."${safeTable}"')::text AS reg`,
  );
  return Boolean(rows[0]?.reg);
}

function fileResponse(doc: {
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageProvider?: string | null;
  storageKey?: string | null;
  data: Buffer;
}) {
  return readDocumentObject({
    provider: doc.storageProvider,
    key: doc.storageKey,
    data: doc.data,
  }).then((fileBuffer) => {
    const body = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Length": String(doc.sizeBytes || fileBuffer.length),
        "Content-Disposition": `inline; filename="${contentDispositionFileName(doc.fileName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { sourceType: string; ownerId: string; docId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sourceType = String(params.sourceType || "").toLowerCase();

  if (sourceType === "forecast") {
    if (!(await tableExists("ProjectDocument"))) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const doc = await prisma.projectDocument.findFirst({
      where: { id: params.docId, projectId: params.ownerId, isDeleted: false },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return fileResponse(doc);
  }

  if (sourceType === "shipment") {
    if (!(await tableExists("ShipmentDocument"))) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const doc = await prisma.shipmentDocument.findFirst({
      where: { id: params.docId, shipmentId: params.ownerId, isDeleted: false },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.documentGroup === "critical" && !isExecutiveRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return fileResponse(doc);
  }

  if (sourceType === "daily_delivery") {
    if (!(await tableExists("DailyDeliveryDocument"))) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const doc = await prisma.dailyDeliveryDocument.findFirst({
      where: { id: params.docId, dailyDeliveryId: params.ownerId, isDeleted: false },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    return fileResponse(doc);
  }

  return NextResponse.json({ error: "Unsupported document source" }, { status: 400 });
}
