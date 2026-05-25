import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole } from "@/lib/role-access";
import { storeDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";

async function ensureProjectDocumentTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProjectDocument" (
      "id" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "requirementCode" TEXT,
      "requirementLabel" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT,
      "sizeBytes" INTEGER NOT NULL DEFAULT 0,
      "data" BYTEA NOT NULL,
      "storageProvider" TEXT,
      "storageKey" TEXT,
      "storageUrl" TEXT,
      "uploadedBy" TEXT,
      "uploadedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;`);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "project-document";
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadModuleForRole(session.user.role, "OPERATIONS_TRAFFIC") && !canReadModuleForRole(session.user.role, "PL_SALES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureProjectDocumentTable();
  const docs = await prisma.projectDocument.findMany({
    where: { projectId: params.id, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      requirementCode: true,
      requirementLabel: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageProvider: true,
      storageKey: true,
      storageUrl: true,
      uploadedBy: true,
      uploadedByName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, documents: docs });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteModuleForRole(session.user.role, "OPERATIONS_TRAFFIC") && !canWriteModuleForRole(session.user.role, "PL_SALES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureProjectDocumentTable();

  const project = await prisma.projectItem.findUnique({ where: { id: params.id } });
  if (!project || project.isDeleted) return NextResponse.json({ error: "Forecast Sales not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requirementCode = String(formData.get("requirementCode") || "").trim() || null;
  const requirementLabel = String(formData.get("requirementLabel") || "").trim() || "Forecast Sales document";

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const maxSize = 10 * 1024 * 1024;
  if (buffer.length > maxSize) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ];
  if (file.type && !allowed.includes(file.type)) {
    return NextResponse.json({ error: "File MIME type not allowed" }, { status: 400 });
  }

  const storedFile = await storeDocumentObject({
    scope: "project",
    ownerId: params.id,
    fileName: file.name || "project-document",
    mimeType: file.type || "application/octet-stream",
    buffer,
  });

  const doc = await prisma.projectDocument.create({
    data: {
      projectId: params.id,
      requirementCode,
      requirementLabel,
      fileName: sanitizeFileName(file.name || "project-document"),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      data: storedFile.data,
      storageProvider: storedFile.provider,
      storageKey: storedFile.key,
      storageUrl: storedFile.url,
      uploadedBy: session.user.id,
      uploadedByName: session.user.name || session.user.email || null,
    },
    select: {
      id: true,
      projectId: true,
      requirementCode: true,
      requirementLabel: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageProvider: true,
      storageKey: true,
      storageUrl: true,
      uploadedBy: true,
      uploadedByName: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "PROJECT_DOCUMENT_UPLOAD",
      entity: "ProjectDocument",
      entityId: doc.id,
      details: JSON.stringify({ projectId: params.id, requirementLabel, fileName: doc.fileName, sizeBytes: doc.sizeBytes }),
    },
  }).catch(() => null);

  return NextResponse.json({
    success: true,
    document: doc,
    url: `/api/projects/${params.id}/documents/${doc.id}`,
  });
}
