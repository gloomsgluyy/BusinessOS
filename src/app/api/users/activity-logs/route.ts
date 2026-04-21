import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ATTENDANCE_PATTERN = /(attendance|absensi|presensi|check[\s_-]?in|check[\s_-]?out|clock[\s_-]?(in|out)|punch[\s_-]?(in|out))/i;

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(num)));
}

function isAttendanceActivity(action: string, entity: string, details: string | null): boolean {
    return ATTENDANCE_PATTERN.test(`${action} ${entity} ${details || ""}`);
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requesterRole = String(session.user.role || "").toUpperCase();
        if (requesterRole !== UserRole.CEO) {
            return NextResponse.json(
                { error: "Unauthorized. Only CEO can access user activity logs." },
                { status: 403 }
            );
        }

        const url = new URL(request.url);
        const take = parseBoundedInt(url.searchParams.get("limit"), 120, 1, 500);
        const days = parseBoundedInt(url.searchParams.get("days"), 90, 1, 365);

        const fromDate = new Date();
        fromDate.setHours(0, 0, 0, 0);
        fromDate.setDate(fromDate.getDate() - days + 1);

        const rawLogs = await prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: fromDate,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take,
            select: {
                id: true,
                userId: true,
                userName: true,
                action: true,
                entity: true,
                entityId: true,
                details: true,
                createdAt: true,
            },
        });

        const logs = rawLogs.map((log) => {
            const attendance = isAttendanceActivity(log.action, log.entity, log.details);
            return {
                id: log.id,
                userId: log.userId,
                userName: log.userName,
                action: log.action,
                entity: log.entity,
                entityId: log.entityId,
                details: log.details,
                createdAt: log.createdAt.toISOString(),
                isAttendance: attendance,
            };
        });

        const summaryMap = new Map<
            string,
            {
                userId: string;
                userName: string;
                totalLogs: number;
                attendanceLogs: number;
                lastActivityAt: string;
                lastAttendanceAt: string | null;
            }
        >();

        for (const log of logs) {
            const current =
                summaryMap.get(log.userId) ||
                {
                    userId: log.userId,
                    userName: log.userName,
                    totalLogs: 0,
                    attendanceLogs: 0,
                    lastActivityAt: log.createdAt,
                    lastAttendanceAt: null as string | null,
                };

            current.totalLogs += 1;
            if (log.isAttendance) {
                current.attendanceLogs += 1;
                if (!current.lastAttendanceAt || new Date(log.createdAt) > new Date(current.lastAttendanceAt)) {
                    current.lastAttendanceAt = log.createdAt;
                }
            }

            if (new Date(log.createdAt) > new Date(current.lastActivityAt)) {
                current.lastActivityAt = log.createdAt;
            }

            summaryMap.set(log.userId, current);
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
            },
            orderBy: [
                { name: "asc" },
                { email: "asc" },
            ],
        });

        const usersSummary = users
            .map((user) => {
                const summary = summaryMap.get(user.id);
                return {
                    userId: user.id,
                    userName: user.name || user.email || "Unknown",
                    totalLogs: summary?.totalLogs || 0,
                    attendanceLogs: summary?.attendanceLogs || 0,
                    lastActivityAt: summary?.lastActivityAt || "",
                    lastAttendanceAt: summary?.lastAttendanceAt || null,
                };
            })
            .sort((a, b) => {
                const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
                const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
                return bTime - aTime;
            });

        return NextResponse.json({
            success: true,
            totals: {
                totalLogs: logs.length,
                attendanceLogs: logs.filter((log) => log.isAttendance).length,
                users: usersSummary.length,
                days,
            },
            usersSummary,
            logs,
        });
    } catch (error) {
        console.error("GET /api/users/activity-logs error:", error);
        return NextResponse.json({ error: "Failed to fetch user activity logs" }, { status: 500 });
    }
}
