import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";
const SHEET_TAB = "Outstanding Payment";

function parseNum(v: any): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
}
function parseDate(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function fmtDate(d: Date | null): string { return d ? d.toISOString().split('T')[0] : ""; }

let paymentColumnsReady = false;
async function ensureOutstandingPaymentColumns() {
    if (paymentColumnsReady) return;
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "shipmentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "shipmentName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "paymentProofDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "notes" TEXT;`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OutstandingPayment_shipmentId_idx" ON "OutstandingPayment"("shipmentId");`);
    paymentColumnsReady = true;
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureOutstandingPaymentColumns();

        const url = new URL(req.url);
        const pagination = parsePaginationParams(url.searchParams);
        const where = { isDeleted: false };

        if (pagination) {
            const [records, totalItems] = await Promise.all([
                prisma.outstandingPayment.findMany({ where, orderBy: { createdAt: pagination.sortOrder }, skip: pagination.skip, take: pagination.take }),
                prisma.outstandingPayment.count({ where }),
            ]);
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            return NextResponse.json({ success: true, outstandingPayments: records, meta });
        }

        const records = await prisma.outstandingPayment.findMany({ where, orderBy: { createdAt: "desc" } });
        return NextResponse.json({ success: true, outstandingPayments: records });
    } catch (error) {
        console.error("GET /api/memory/outstanding-payment error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureOutstandingPaymentColumns();
        const data = await req.json();

        const record = await prisma.outstandingPayment.create({
            data: {
                shipmentId: data.shipmentId ?? data.shipment_id,
                shipmentName: data.shipmentName ?? data.shipment_name,
                invoiceNumber: data.invoiceNumber ?? data.invoice_number,
                invoiceDocumentId: data.invoiceDocumentId ?? data.invoice_document_id,
                paymentProofDocumentId: data.paymentProofDocumentId ?? data.payment_proof_document_id,
                perusahaan: data.perusahaan || "Unknown",
                kodeBatu: data.kodeBatu ?? data.kode_batu,
                priceInclPph: parseNum(data.priceInclPph ?? data.price_incl_pph),
                qty: parseNum(data.qty),
                totalDp: parseNum(data.totalDp ?? data.total_dp),
                calculationDate: parseDate(data.calculationDate ?? data.calculation_date),
                dpToShipment: parseDate(data.dpToShipment ?? data.dp_to_shipment),
                dueDate: parseDate(data.dueDate ?? data.due_date),
                disputeStatus: data.disputeStatus ?? data.dispute_status,
                notes: data.notes,
                timeframeDays: data.timeframeDays,
                status: data.status || "pending",
                year: data.year || new Date().getFullYear(),
            }
        });

        try {
            await appendRow(SHEET_TAB, [
                record.id, record.perusahaan, record.kodeBatu, record.priceInclPph,
                record.qty, record.totalDp, fmtDate(record.calculationDate),
                fmtDate(record.dpToShipment), record.timeframeDays, record.status,
                record.year, record.updatedAt.toISOString()
            ]);
        } catch (e) { console.error("Sheet write failed for OutstandingPayment", e); }

        return NextResponse.json({ success: true, payment: record });
    } catch (error) {
        console.error("POST /api/memory/outstanding-payment error:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureOutstandingPaymentColumns();
        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const record = await prisma.outstandingPayment.update({
            where: { id: data.id },
            data: {
                shipmentId: data.shipmentId !== undefined ? data.shipmentId : (data.shipment_id !== undefined ? data.shipment_id : undefined),
                shipmentName: data.shipmentName !== undefined ? data.shipmentName : (data.shipment_name !== undefined ? data.shipment_name : undefined),
                invoiceNumber: data.invoiceNumber !== undefined ? data.invoiceNumber : (data.invoice_number !== undefined ? data.invoice_number : undefined),
                invoiceDocumentId: data.invoiceDocumentId !== undefined ? data.invoiceDocumentId : (data.invoice_document_id !== undefined ? data.invoice_document_id : undefined),
                paymentProofDocumentId: data.paymentProofDocumentId !== undefined ? data.paymentProofDocumentId : (data.payment_proof_document_id !== undefined ? data.payment_proof_document_id : undefined),
                perusahaan: data.perusahaan,
                kodeBatu: data.kodeBatu !== undefined ? data.kodeBatu : (data.kode_batu !== undefined ? data.kode_batu : undefined),
                priceInclPph: data.priceInclPph !== undefined ? parseNum(data.priceInclPph) : (data.price_incl_pph !== undefined ? parseNum(data.price_incl_pph) : undefined),
                qty: data.qty !== undefined ? parseNum(data.qty) : undefined,
                totalDp: data.totalDp !== undefined ? parseNum(data.totalDp) : (data.total_dp !== undefined ? parseNum(data.total_dp) : undefined),
                calculationDate: data.calculationDate !== undefined ? parseDate(data.calculationDate) : (data.calculation_date !== undefined ? parseDate(data.calculation_date) : undefined),
                dpToShipment: data.dpToShipment !== undefined ? parseDate(data.dpToShipment) : (data.dp_to_shipment !== undefined ? parseDate(data.dp_to_shipment) : undefined),
                dueDate: data.dueDate !== undefined ? parseDate(data.dueDate) : (data.due_date !== undefined ? parseDate(data.due_date) : undefined),
                disputeStatus: data.disputeStatus !== undefined ? data.disputeStatus : (data.dispute_status !== undefined ? data.dispute_status : undefined),
                notes: data.notes,
                timeframeDays: data.timeframeDays, status: data.status, year: data.year,
            }
        });

        try {
            await upsertRow(SHEET_TAB, 0, record.id, [
                record.id, record.perusahaan, record.kodeBatu, record.priceInclPph,
                record.qty, record.totalDp, fmtDate(record.calculationDate),
                fmtDate(record.dpToShipment), record.timeframeDays, record.status,
                record.year, record.updatedAt.toISOString()
            ]);
        } catch (e) { console.error("Sheet update failed for OutstandingPayment", e); }

        return NextResponse.json({ success: true, payment: record });
    } catch (error) {
        console.error("PUT /api/memory/outstanding-payment error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureOutstandingPaymentColumns();
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        await prisma.outstandingPayment.update({ where: { id }, data: { isDeleted: true } });
        try {
            const rowIndex = await findRowIndex(SHEET_TAB, 0, id);
            if (rowIndex > 0) await deleteRow(SHEET_TAB, rowIndex);
        } catch (e) { console.error("Sheet delete failed", e); }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/outstanding-payment error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
