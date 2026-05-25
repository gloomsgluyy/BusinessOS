import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { jsPDF } from "jspdf";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let shippingInstructionTableReady = false;

async function ensureShippingInstructionTable() {
  if (shippingInstructionTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShippingInstructionRecord" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "siNumber" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL DEFAULT 'generated',
      "reason" TEXT,
      "earlyApprovalReason" TEXT,
      "approvedBy" TEXT,
      "approvedByName" TEXT,
      "approvedAt" TIMESTAMP(3),
      "approvalComment" TEXT,
      "cancellationReason" TEXT,
      "cancelledBy" TEXT,
      "cancelledByName" TEXT,
      "cancelledAt" TIMESTAMP(3),
      "pdfFileName" TEXT,
      "pdfGeneratedAt" TIMESTAMP(3),
      "snapshot" TEXT NOT NULL DEFAULT '{}',
      "generatedBy" TEXT,
      "generatedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShippingInstructionRecord_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "pdfFileName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "pdfGeneratedAt" TIMESTAMP(3);`);
  shippingInstructionTableReady = true;
}

function canReadSi(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
}

function cleanText(value: unknown, fallback = "-") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function safeFileName(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 160) || "shipping-instruction";
}

function parseSnapshot(value: string | null | undefined) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
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
  y = writeLabelValue(doc, "QUANTITY TOLERANCE", snapshot.quantityTolerance, left, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENT REQUIRED", left, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const requiredDocs = [
    "COPY OF LAPORAN HASIL VERIFIKASI",
    "1 ORIGINAL DRAUGHT SURVEY REPORT",
    "1 ORIGINAL SURAT KETERANGAN ASAL BARANG",
    "1 ORIGINAL SURAT KEBENARAN DOKUMEN",
    "1 ORIGINAL SURAT KIRIM BARANG",
    "1 ORIGINAL BUKTI BAYAR ROYALTI",
    "3/3 ORIGINAL BILL OF LADING ISSUED BY LOADPORT AGENT",
  ];
  requiredDocs.forEach((item, index) => {
    const text = doc.splitTextToSize(`${index + 1}. ${item}`, 470);
    doc.text(text, left, y);
    y += text.length * 11 + 3;
  });

  y = Math.max(y + 26, 680);
  doc.setFont("helvetica", "normal");
  doc.text("Kop surat intentionally left blank for manual stamp/signature.", left, y);
  y += 44;
  doc.line(380, y, 530, y);
  doc.text("Authorized Signature", 398, y + 14);

  return Buffer.from(doc.output("arraybuffer"));
}

export async function GET(_req: Request, { params }: { params: { id: string; recordId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadSi(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureShippingInstructionTable();

  const record = await prisma.shippingInstructionRecord.findFirst({
    where: { id: params.recordId, shipmentId: params.id, isDeleted: false },
  });
  if (!record) return NextResponse.json({ error: "SI record not found" }, { status: 404 });

  const pdfBuffer = generateSiPdf(record);
  const fileName = record.pdfFileName || `${safeFileName(record.siNumber)}-v${record.version}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBuffer.length),
      "Content-Disposition": `attachment; filename="${fileName.replace(/["\r\n]/g, "_")}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
