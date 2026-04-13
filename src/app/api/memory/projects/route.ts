import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const text = String(v).replace(/\s+/g, " ").trim();
  return text || null;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projects = await prisma.projectItem.findMany({
      where: { isDeleted: false },
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

    const data = await req.json();
    const name = cleanText(data.name);
    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.projectItem.create({
        data: {
          name,
          segment: cleanText(data.segment),
          buyer: cleanText(data.buyer),
          status: cleanText(data.status) || "draft",
          notes: cleanText(data.notes),
          createdBy: session.user.id,
          createdByName: session.user.name || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          action: "CREATE",
          entity: "ProjectItem",
          entityId: created.id,
          details: JSON.stringify({
            name: created.name,
            segment: created.segment,
            buyer: created.buyer,
            status: created.status,
          }),
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("POST /api/memory/projects error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: "Project ID missing" }, { status: 400 });

    const existing = await prisma.projectItem.findUnique({ where: { id: data.id } });
    if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nextName = data.name !== undefined ? cleanText(data.name) : undefined;
    if (data.name !== undefined && !nextName) {
      return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
    }

    const project = await prisma.$transaction(async (tx) => {
      const nextStatus =
        data.status !== undefined ? (cleanText(data.status) || undefined) : undefined;
      const updated = await tx.projectItem.update({
        where: { id: data.id },
        data: {
          name: nextName || undefined,
          segment: data.segment !== undefined ? cleanText(data.segment) : undefined,
          buyer: data.buyer !== undefined ? cleanText(data.buyer) : undefined,
          status: nextStatus,
          notes: data.notes !== undefined ? cleanText(data.notes) : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          action: "UPDATE",
          entity: "ProjectItem",
          entityId: updated.id,
          details: JSON.stringify(data),
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("PUT /api/memory/projects error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Project ID missing" }, { status: 400 });

    const existing = await prisma.projectItem.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.projectItem.update({
        where: { id },
        data: { isDeleted: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          action: "DELETE",
          entity: "ProjectItem",
          entityId: id,
          details: JSON.stringify({ isDeleted: true }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/memory/projects error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
