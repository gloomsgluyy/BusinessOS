import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
const SHEET_TAB = "Daily Delivery";

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

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const records = await prisma.dailyDelivery.findMany({ where: { isDeleted: false }, orderBy: { createdAt: "desc" } });
        return NextResponse.json({ success: true, dailyDeliveries: records });
    } catch (error) {
        console.error("GET /api/memory/daily-delivery error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const data = await req.json();

        const record = await prisma.dailyDelivery.create({
            data: {
                reportType: data.reportType || "domestic",
                year: data.year || new Date().getFullYear(),
                shipmentStatus: data.shipmentStatus, buyer: data.buyer, pod: data.pod,
                shippingTerm: data.shippingTerm, latestEtaPod: parseDate(data.latestEtaPod),
                arriveAtPod: parseDate(data.arriveAtPod), keterlambatan: data.keterlambatan,
                pol: data.pol, laycanPol: data.laycanPol, area: data.area, supplier: data.supplier,
                mvBargeNomination: data.mvBargeNomination, issue: data.issue, blMonth: data.blMonth,
                blQuantity: parseNum(data.blQuantity), blDate: parseDate(data.blDate),
                analysisMethod: data.analysisMethod,
                surveyorPol: data.surveyorPol, surveyorPod: data.surveyorPod,
                project: data.project, flow: data.flow,
                terpal: data.terpal, insurance: data.insurance,
                basePrice: parseNum(data.basePrice), basePriceNotes: data.basePriceNotes,
                poMonth: data.poMonth, product: data.product,
                arriveAtPol: parseDate(data.arriveAtPol),
                commenceLoading: parseDate(data.commenceLoading),
                completeLoading: parseDate(data.completeLoading),
                startDischarging: parseDate(data.startDischarging),
                completeDischarged: parseDate(data.completeDischarged),
                podQuantity: parseNum(data.podQuantity),
                lossGainCargo: parseNum(data.lossGainCargo),
                poNo: data.poNo, contractNo: data.contractNo, contractType: data.contractType,
                invoicePrice: parseNum(data.invoicePrice), invoiceAmount: parseNum(data.invoiceAmount),
                paymentDueDate: parseDate(data.paymentDueDate),
                paymentStatus: data.paymentStatus, specContract: data.specContract,
                actualGcvGar: parseNum(data.actualGcvGar),
                actualTs: parseNum(data.actualTs), actualAsh: parseNum(data.actualAsh), actualTm: parseNum(data.actualTm),
            }
        });

        try {
            await appendRow(SHEET_TAB, [
                record.id, record.reportType, record.year, record.shipmentStatus, record.buyer,
                record.pod, record.shippingTerm, fmtDate(record.latestEtaPod), fmtDate(record.arriveAtPod),
                record.keterlambatan, record.pol, record.laycanPol, record.area, record.supplier,
                record.mvBargeNomination, record.issue, record.blMonth, record.blQuantity, fmtDate(record.blDate),
                record.surveyorPol, record.surveyorPod, record.project, record.flow, record.basePrice,
                record.poNo, record.contractNo, record.contractType, record.invoicePrice,
                fmtDate(record.paymentDueDate), record.paymentStatus, record.actualGcvGar,
                record.actualTs, record.actualAsh, record.actualTm, record.updatedAt.toISOString()
            ]);
        } catch (e) { console.error("Sheet write failed for DailyDelivery", e); }

        return NextResponse.json({ success: true, delivery: record });
    } catch (error) {
        console.error("POST /api/memory/daily-delivery error:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const record = await prisma.dailyDelivery.update({
            where: { id: data.id },
            data: {
                reportType: data.reportType, year: data.year,
                shipmentStatus: data.shipmentStatus, buyer: data.buyer, pod: data.pod,
                shippingTerm: data.shippingTerm,
                latestEtaPod: data.latestEtaPod !== undefined ? parseDate(data.latestEtaPod) : undefined,
                arriveAtPod: data.arriveAtPod !== undefined ? parseDate(data.arriveAtPod) : undefined,
                keterlambatan: data.keterlambatan, pol: data.pol, laycanPol: data.laycanPol,
                area: data.area, supplier: data.supplier, mvBargeNomination: data.mvBargeNomination,
                issue: data.issue, blMonth: data.blMonth,
                blQuantity: data.blQuantity !== undefined ? parseNum(data.blQuantity) : undefined,
                blDate: data.blDate !== undefined ? parseDate(data.blDate) : undefined,
                analysisMethod: data.analysisMethod,
                surveyorPol: data.surveyorPol, surveyorPod: data.surveyorPod,
                project: data.project, flow: data.flow,
                terpal: data.terpal, insurance: data.insurance,
                basePrice: data.basePrice !== undefined ? parseNum(data.basePrice) : undefined,
                basePriceNotes: data.basePriceNotes,
                poMonth: data.poMonth, product: data.product,
                arriveAtPol: data.arriveAtPol !== undefined ? parseDate(data.arriveAtPol) : undefined,
                commenceLoading: data.commenceLoading !== undefined ? parseDate(data.commenceLoading) : undefined,
                completeLoading: data.completeLoading !== undefined ? parseDate(data.completeLoading) : undefined,
                startDischarging: data.startDischarging !== undefined ? parseDate(data.startDischarging) : undefined,
                completeDischarged: data.completeDischarged !== undefined ? parseDate(data.completeDischarged) : undefined,
                podQuantity: data.podQuantity !== undefined ? parseNum(data.podQuantity) : undefined,
                lossGainCargo: data.lossGainCargo !== undefined ? parseNum(data.lossGainCargo) : undefined,
                poNo: data.poNo, contractNo: data.contractNo, contractType: data.contractType,
                invoicePrice: data.invoicePrice !== undefined ? parseNum(data.invoicePrice) : undefined,
                invoiceAmount: data.invoiceAmount !== undefined ? parseNum(data.invoiceAmount) : undefined,
                paymentDueDate: data.paymentDueDate !== undefined ? parseDate(data.paymentDueDate) : undefined,
                paymentStatus: data.paymentStatus, specContract: data.specContract,
                actualGcvGar: data.actualGcvGar !== undefined ? parseNum(data.actualGcvGar) : undefined,
                actualTs: data.actualTs !== undefined ? parseNum(data.actualTs) : undefined,
                actualAsh: data.actualAsh !== undefined ? parseNum(data.actualAsh) : undefined,
                actualTm: data.actualTm !== undefined ? parseNum(data.actualTm) : undefined,
            }
        });

        return NextResponse.json({ success: true, delivery: record });
    } catch (error) {
        console.error("PUT /api/memory/daily-delivery error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        await prisma.dailyDelivery.update({ where: { id }, data: { isDeleted: true } });
        try {
            const rowIndex = await findRowIndex(SHEET_TAB, 0, id);
            if (rowIndex > 0) await deleteRow(SHEET_TAB, rowIndex);
        } catch (e) { console.error("Sheet delete failed", e); }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/daily-delivery error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
