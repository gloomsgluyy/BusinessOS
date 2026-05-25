import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { normalizeRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canReadAudit(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === "CEO" || normalized === "DIRUT" || normalized === "ASS_DIRUT";
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReadAudit(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const entity = url.searchParams.get("entity")?.trim();
    const action = url.searchParams.get("action")?.trim();
    const take = Math.min(Math.max(Number(url.searchParams.get("take") || 150), 1), 500);

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: {
          select: {
            role: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        user_id: log.userId,
        user_name: log.userName,
        user_role: String(log.user?.role || "").toLowerCase(),
        user_email: log.user?.email || null,
        action: log.action,
        entity: log.entity,
        entity_id: log.entityId,
        target: `${log.entity} ${log.entityId}`,
        details: log.details,
        created_at: log.createdAt,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
