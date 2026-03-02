import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllProjectsToSheet } from "@/app/actions/sheet-actions";

async function pushToSheets() {
    try {
        const deals = await prisma.salesDeal.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });
        const formatted = deals.map((d: any) => ({
            id: d.id, buyer: d.buyer, buyer_country: d.buyerCountry, type: d.type,
            quantity: d.quantity, price_per_mt: d.pricePerMt, total_value: d.totalValue,
            status: d.status, vessel_name: d.vesselName, laycan_start: d.laycanStart ? d.laycanStart.toISOString().split('T')[0] : "",
            laycan_end: d.laycanEnd ? d.laycanEnd.toISOString().split('T')[0] : "", pic_name: d.picName,
            updated_at: d.updatedAt.toISOString()
        }));
        await syncAllProjectsToSheet(formatted);
    } catch (err) {
        console.error("Failed to sync Sales Deals to sheets:", err);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        const deal = await prisma.$transaction(async (tx) => {
            const newDeal = await tx.salesDeal.create({
                data: {
                    dealNumber: data.dealNumber || `SD-${Date.now()}`,
                    status: data.status || "pre_sale",
                    buyer: data.buyer,
                    buyerCountry: data.buyerCountry,
                    type: data.type || "export",
                    shippingTerms: data.shippingTerms || "FOB",
                    quantity: data.quantity ? parseFloat(data.quantity.toString()) : 0,
                    pricePerMt: data.pricePerMt ? parseFloat(data.pricePerMt.toString()) : null,
                    totalValue: data.totalValue ? parseFloat(data.totalValue.toString()) : null,
                    laycanStart: data.laycanStart ? new Date(data.laycanStart) : null,
                    laycanEnd: data.laycanEnd ? new Date(data.laycanEnd) : null,
                    vesselName: data.vesselName,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : null,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : null,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : null,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : null,
                    projectId: data.projectId,
                    picId: data.picId,
                    picName: data.picName || session.user.name,
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

        await pushToSheets();

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

        const deal = await prisma.$transaction(async (tx) => {
            const updatedDeal = await tx.salesDeal.update({
                where: { id: data.id },
                data: {
                    status: data.status,
                    buyer: data.buyer,
                    buyerCountry: data.buyerCountry,
                    type: data.type,
                    shippingTerms: data.shippingTerms,
                    quantity: data.quantity ? parseFloat(data.quantity.toString()) : undefined,
                    pricePerMt: data.pricePerMt ? parseFloat(data.pricePerMt.toString()) : undefined,
                    totalValue: data.totalValue ? parseFloat(data.totalValue.toString()) : undefined,
                    laycanStart: data.laycanStart ? new Date(data.laycanStart) : undefined,
                    laycanEnd: data.laycanEnd ? new Date(data.laycanEnd) : undefined,
                    vesselName: data.vesselName,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : undefined,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : undefined,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : undefined,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : undefined,
                    projectId: data.projectId,
                    picId: data.picId,
                    picName: data.picName
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

        await pushToSheets();

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

        pushToSheets();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to delete sales deal" }, { status: 500 });
    }
}
