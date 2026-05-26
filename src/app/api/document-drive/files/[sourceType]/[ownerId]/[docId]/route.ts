import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { jsPDF } from "jspdf";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isExecutiveRole } from "@/lib/role-access";
import { readDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function contentDispositionFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

function cleanText(value: unknown, fallback = "-") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function parseSnapshot(value: string | null | undefined) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function safeFileName(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 160) || "shipping-instruction";
}

function writeLabelValue(doc: jsPDF, label: string, value: unknown, x: number, y: number, width = 455) {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  const text = doc.splitTextToSize(cleanText(value), width);
  doc.text(text, x + 145, y);
  return y + Math.max(15, text.length * 12);
}

function generateSiPdf(record: any) {
  const snapshot = parseSnapshot(record.snapshot);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const left = 54;
  let y = 58;

  doc.setProperties({ title: `Shipping Instruction ${record.siNumber} v${record.version}` });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SHIPPING INSTRUCTION", left, y);
  doc.setFontSize(10);
  doc.text(`NO.: ${record.siNumber}`, 410, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Version ${record.version} | Status: ${record.status} | Generated: ${record.createdAt ? new Date(record.createdAt).toLocaleString("en-GB") : "-"}`, left, y);
  y += 30;
  doc.setDrawColor(180);
  doc.line(left, y, 540, y);
  y += 22;
  doc.setFontSize(10);

  y = writeLabelValue(doc, "PROJECT / FROM MV", snapshot.forecastSalesName || snapshot.vesselName, left, y);
  y = writeLabelValue(doc, "FCO NUMBER", snapshot.fcoNumber, left, y);
  y = writeLabelValue(doc, "SHIPPER", snapshot.siShipper || snapshot.supplier, left, y);
  y = writeLabelValue(doc, "CONSIGNEE", snapshot.consignee, left, y);
  y = writeLabelValue(doc, "NOTIFY PARTY", snapshot.notifyParty, left, y);
  y = writeLabelValue(doc, "VESSEL / BARGE", [snapshot.vesselName, snapshot.bargeName || snapshot.nomination].filter(Boolean).join(" / "), left, y);
  y = writeLabelValue(doc, "COMMODITY", snapshot.product || "Coal", left, y);
  y = writeLabelValue(doc, "QUANTITY", snapshot.quantity ? `${Number(snapshot.quantity).toLocaleString("en-US")} MT` : "-", left, y);
  y = writeLabelValue(doc, "LAYCAN", snapshot.laycan, left, y);
  y = writeLabelValue(doc, "LOADING PORT", snapshot.loadingPort, left, y);
  y = writeLabelValue(doc, "DISCHARGE PORT", snapshot.dischargePort, left, y);
  y = writeLabelValue(doc, "SHIPPING TERM", snapshot.shippingTerm, left, y);
  y = writeLabelValue(doc, "SURVEYOR", snapshot.surveyor, left, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENT REQUIRED", left, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  [
    "COPY OF LAPORAN HASIL VERIFIKASI",
    "1 ORIGINAL DRAUGHT SURVEY REPORT",
    "1 ORIGINAL SURAT KETERANGAN ASAL BARANG",
    "1 ORIGINAL SURAT KEBENARAN DOKUMEN",
    "1 ORIGINAL SURAT KIRIM BARANG",
    "1 ORIGINAL BUKTI BAYAR ROYALTI",
    "3/3 ORIGINAL BILL OF LADING ISSUED BY LOADPORT AGENT",
  ].forEach((item, index) => {
    const text = doc.splitTextToSize(`${index + 1}. ${item}`, 470);
    doc.text(text, left, y);
    y += text.length * 11 + 3;
  });

  y = Math.max(y + 26, 680);
  doc.text("Kop surat intentionally left blank for manual stamp/signature.", left, y);
  y += 44;
  doc.line(380, y, 530, y);
  doc.text("Authorized Signature", 398, y + 14);

  return Buffer.from(doc.output("arraybuffer"));
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
    if (doc.documentGroup === "critical" && !isExecutiveRole(session?.user?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return fileResponse(doc);
  }

  if (sourceType === "shipping_instruction") {
    if (!(await tableExists("ShippingInstructionRecord"))) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const record = await prisma.shippingInstructionRecord.findFirst({
      where: {
        id: params.docId,
        shipmentId: params.ownerId,
        isDeleted: false,
        status: { notIn: ["cancelled", "rejected"] },
      },
    });
    if (!record) return NextResponse.json({ error: "SI record not found" }, { status: 404 });
    const pdfBuffer = generateSiPdf(record);
    const fileName = record.pdfFileName || `${safeFileName(record.siNumber)}-v${record.version}.pdf`;
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.length),
        "Content-Disposition": `inline; filename="${contentDispositionFileName(fileName)}"`,
        "Cache-Control": "public, max-age=120",
      },
    });
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
