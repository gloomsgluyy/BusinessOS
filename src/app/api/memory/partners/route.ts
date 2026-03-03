import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncPartnersToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush(model: string = "partner") {
    // Non-blocking trigger
    PushService.pushModelToSheets(model).catch(err => {
        console.error(`Failed to push ${model} to sheets:`, err);
    });
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const partners = await prisma.partner.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, partners });
    } catch (error) {
        console.error("GET /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        const partner = await prisma.$transaction(async (tx) => {
            const newPartner = await tx.partner.create({
                data: {
                    name: data.name,
                    type: data.type || "buyer",
                    category: data.category,
                    contactPerson: data.pic || data.contactPerson,
                    phone: data.phone,
                    email: data.email,
                    city: data.region?.split(',')[0]?.trim(),
                    country: data.region?.split(',')[1]?.trim() || data.country,
                    taxId: data.taxId,
                    status: data.status || "active",
                    notes: data.notes
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "Partner",
                    entityId: newPartner.id,
                    details: JSON.stringify(newPartner)
                }
            });

            return newPartner;
        });

        await triggerPush();

        return NextResponse.json({ success: true, partner });
    } catch (error) {
        console.error("POST /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to create partner" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Partner ID missing" }, { status: 400 });

        const partner = await prisma.$transaction(async (tx) => {
            const updatedPartner = await tx.partner.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    type: data.type,
                    category: data.category,
                    contactPerson: data.pic || data.contactPerson,
                    phone: data.phone,
                    email: data.email,
                    city: data.region?.split(',')[0]?.trim(),
                    country: data.region?.split(',')[1]?.trim() || data.country,
                    taxId: data.taxId,
                    status: data.status,
                    notes: data.notes
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "Partner",
                    entityId: updatedPartner.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedPartner;
        });

        await triggerPush();

        return NextResponse.json({ success: true, partner });
    } catch (error) {
        console.error("PUT /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to update partner" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Partner ID missing" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await tx.partner.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "Partner",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to delete partner" }, { status: 500 });
    }
}
