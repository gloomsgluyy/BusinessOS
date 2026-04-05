import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";

// Note: This syncs from "Projects" sheet
async function triggerPush() {
    PushService.debouncedPush("salesDeal").catch(err => console.error("Optional Sheet push failed:", err));
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // DATABASE-FIRST: Read directly from database
        const deals = await prisma.salesDeal.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, deals });
    } catch (error) {
        console.error("GET /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to fetch sales deals" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        const id = `SD-${Date.now()}`;
        const dealNumber = data.deal_number || data.dealNumber || id;

        // DATABASE-FIRST: Write to database as primary source
        const deal = await prisma.$transaction(async (tx) => {
            const newDeal = await tx.salesDeal.create({
                data: {
                    id: id,
                    dealNumber: dealNumber,
                    status: data.status || "confirmed",
                    buyer: data.buyer,
                    buyerCountry: data.buyer_country || data.buyerCountry,
                    type: data.type || "export",
                    shippingTerms: data.shipping_terms || data.shippingTerms || "FOB",
                    quantity: (data.quantity !== undefined) ? parseFloat(data.quantity.toString()) : 0,
                    pricePerMt: (data.price_per_mt !== undefined) ? parseFloat(data.price_per_mt.toString()) : (data.pricePerMt ? parseFloat(data.pricePerMt.toString()) : null),
                    totalValue: (data.total_value !== undefined) ? parseFloat(data.total_value.toString()) : (data.totalValue ? parseFloat(data.totalValue.toString()) : null),
                    laycanStart: (data.laycan_start || data.laycanStart) ? new Date(data.laycan_start || data.laycanStart) : null,
                    laycanEnd: (data.laycan_end || data.laycanEnd) ? new Date(data.laycan_end || data.laycanEnd) : null,
                    vesselName: data.vessel_name || data.vesselName,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : null,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : null,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : null,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : null,
                    projectId: data.project_id || data.projectId,
                    picId: data.pic_id || data.picId,
                    picName: data.pic_name || data.picName || session.user.name,
                    createdByName: session.user.name,
                    createdBy: session.user.id
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "SalesDeal",
                    entityId: newDeal.id,
                    details: JSON.stringify(newDeal)
                }
            });

            return newDeal;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, deal });
    } catch (error) {
        console.error("POST /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to create sales deal" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Sales Deal ID missing" }, { status: 400 });

        const existingRecord = await prisma.salesDeal.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Update database as primary source
        const deal = await prisma.$transaction(async (tx) => {
            const updatedDeal = await tx.salesDeal.update({
                where: { id: data.id },
                data: {
                    status: data.status,
                    buyer: data.buyer,
                    buyerCountry: data.buyer_country || data.buyerCountry,
                    type: data.type,
                    shippingTerms: data.shipping_terms || data.shippingTerms,
                    quantity: (data.quantity !== undefined) ? parseFloat(data.quantity.toString()) : undefined,
                    pricePerMt: (data.price_per_mt !== undefined) ? parseFloat(data.price_per_mt.toString()) : (data.pricePerMt !== undefined ? parseFloat(data.pricePerMt.toString()) : undefined),
                    totalValue: (data.total_value !== undefined) ? parseFloat(data.total_value.toString()) : (data.totalValue !== undefined ? parseFloat(data.totalValue.toString()) : undefined),
                    laycanStart: (data.laycan_start || data.laycanStart) ? new Date(data.laycan_start || data.laycanStart) : undefined,
                    laycanEnd: (data.laycan_end || data.laycanEnd) ? new Date(data.laycan_end || data.laycanEnd) : undefined,
                    vesselName: data.vessel_name || data.vesselName,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : undefined,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : undefined,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : undefined,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : undefined,
                    projectId: data.project_id || data.projectId,
                    picId: data.pic_id || data.picId,
                    picName: data.pic_name || data.picName
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "SalesDeal",
                    entityId: updatedDeal.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedDeal;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, deal });
    } catch (error) {
        console.error("PUT /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to update sales deal" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Sales Deal ID missing" }, { status: 400 });

        const existingRecord = await prisma.salesDeal.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.$transaction(async (tx) => {
            await tx.salesDeal.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "SalesDeal",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to delete sales deal" }, { status: 500 });
    }
}
