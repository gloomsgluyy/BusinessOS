import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const text = String(v).replace(/\s+/g, " ").trim();
  return text || null;
}

async function ensureProjectTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProjectItem" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "segment" TEXT,
        "buyer" TEXT,
        "status" TEXT NOT NULL DEFAULT 'waiting_approval',
        "notes" TEXT,
        "createdBy" TEXT,
        "createdByName" TEXT,
        "approvedBy" TEXT,
        "approvedByName" TEXT,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`);
  } catch (error) {
    console.error("[projects] ensureProjectTable failed:", error);
  }
}

async function tryAuditLog(userId: string, userName: string, action: string, entityId: string, details: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        action,
        entity: "ProjectItem",
        entityId,
        details,
      },
    });
  } catch (error: any) {
    console.warn("[projects] audit skipped:", error?.code || error?.message);
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTable();

    const url = new URL(req.url);
    const pagination = parsePaginationParams(url.searchParams);
    const where = { isDeleted: false };

    if (pagination) {
      const [projects, totalItems] = await Promise.all([
        prisma.projectItem.findMany({
          where,
          orderBy: { createdAt: pagination.sortOrder },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.projectItem.count({ where }),
      ]);
      const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
      return NextResponse.json({ success: true, projects, meta });
    }

    const projects = await prisma.projectItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("GET /api/memory/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTable();

    const data = await req.json();
    const name = cleanText(data.name);
    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const project = await prisma.projectItem.create({
      data: {
        name,
        segment: cleanText(data.segment),
        buyer: cleanText(data.buyer),
        status: "waiting_approval",
        notes: cleanText(data.notes),
        createdBy: session.user.id,
        createdByName: session.user.name || null,
      },
    });
    await tryAuditLog(
      session.user.id,
      session.user.name || "Unknown",
      "CREATE",
      project.id,
      JSON.stringify({
        name: project.name,
        segment: project.segment,
        buyer: project.buyer,
        status: project.status,
        approvedBy: project.approvedBy,
        approvedByName: project.approvedByName,
        approvedAt: project.approvedAt,
      }),
    );

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("POST /api/memory/projects error:", error);
    return NextResponse.json(
      { error: "Failed to create project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTable();

    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: "Project ID missing" }, { status: 400 });

    const existing = await prisma.projectItem.findUnique({ where: { id: data.id } });
    if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nextName = data.name !== undefined ? cleanText(data.name) : undefined;
    if (data.name !== undefined && !nextName) {
      return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
    }

    const nextStatus =
      data.status !== undefined ? (cleanText(data.status) || undefined) : undefined;
    const userRole = String(session.user.role || "").toLowerCase();
    const approvalTarget = (nextStatus || "").toLowerCase();
    if (approvalTarget && ["approved", "rejected"].includes(approvalTarget) && !["ceo", "director"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden: only CEO/Director can approve project" }, { status: 403 });
    }
    const toApprovalStatus = (nextStatus || "").toLowerCase();
    const shouldSetApproval = toApprovalStatus === "approved";
    const shouldResetApproval = toApprovalStatus === "rejected" || toApprovalStatus === "waiting_approval";
    const project = await prisma.projectItem.update({
      where: { id: data.id },
      data: {
        name: nextName || undefined,
        segment: data.segment !== undefined ? cleanText(data.segment) : undefined,
        buyer: data.buyer !== undefined ? cleanText(data.buyer) : undefined,
        status: nextStatus,
        notes: data.notes !== undefined ? cleanText(data.notes) : undefined,
        approvedBy: shouldSetApproval
          ? session.user.id
          : shouldResetApproval
            ? null
            : undefined,
        approvedByName: shouldSetApproval
          ? (session.user.name || null)
          : shouldResetApproval
            ? null
            : undefined,
        approvedAt: shouldSetApproval
          ? new Date()
          : shouldResetApproval
            ? null
            : undefined,
      },
    });
    await tryAuditLog(
      session.user.id,
      session.user.name || "Unknown",
      "UPDATE",
      project.id,
      JSON.stringify(data),
    );

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("PUT /api/memory/projects error:", error);
    return NextResponse.json(
      { error: "Failed to update project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTable();

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Project ID missing" }, { status: 400 });

    const existing = await prisma.projectItem.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.projectItem.update({
      where: { id },
      data: { isDeleted: true },
    });
    await tryAuditLog(
      session.user.id,
      session.user.name || "Unknown",
      "DELETE",
      id,
      JSON.stringify({ isDeleted: true }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/memory/projects error:", error);
    return NextResponse.json(
      { error: "Failed to delete project", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
