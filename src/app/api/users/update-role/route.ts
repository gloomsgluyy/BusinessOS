import { Prisma, UserRole } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requesterRole = String(session.user.role || "").toUpperCase();
        if (requesterRole !== UserRole.CEO) {
            return NextResponse.json(
                { error: "Unauthorized. Only CEO can perform this action." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { targetUserId, newRole } = body as {
            targetUserId?: string;
            newRole?: string;
        };

        if (!targetUserId || !newRole) {
            return NextResponse.json(
                { error: "Missing Target User ID or New Role." },
                { status: 400 }
            );
        }

        const normalizedRole = String(newRole).toUpperCase();
        if (!Object.values(UserRole).includes(normalizedRole as UserRole)) {
            return NextResponse.json({ error: "Invalid role value." }, { status: 400 });
        }

        if (session.user.id === targetUserId) {
            return NextResponse.json(
                { error: "Action denied. CEO cannot change their own role." },
                { status: 403 }
            );
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });

        if (!targetUser) {
            return NextResponse.json({ error: "Target user not found." }, { status: 404 });
        }

        const updatedUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: targetUserId },
                data: { role: normalizedRole as UserRole },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || session.user.email || "Unknown",
                    action: "UPDATE_ROLE",
                    entity: "User",
                    entityId: user.id,
                    details: JSON.stringify({
                        targetUserId: user.id,
                        targetName: user.name,
                        targetEmail: user.email,
                        oldRole: String(targetUser.role),
                        newRole: String(user.role),
                    }),
                },
            });

            return user;
        });

        return NextResponse.json(
            { message: "Role updated successfully", user: updatedUser },
            { status: 200 }
        );
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return NextResponse.json({ error: "Target user not found." }, { status: 404 });
        }

        console.error("Error updating user role:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}