import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole } from "@/lib/role-access";
import { readDocumentObject } from "@/lib/document-storage";

export const dynamic = "force-dynamic";

function contentDispositionFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}

async function ensureProjectDocumentStorageColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;`);
}

export async function GET(_req: Request, { params }: { params: { id: string; docId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadModuleForRole(session.user.role, "OPERATIONS_TRAFFIC") && !canReadModuleForRole(session.user.role, "PL_SALES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureProjectDocumentStorageColumns();

  const doc = await prisma.projectDocument.findFirst({
    where: { id: params.docId, projectId: params.id, isDeleted: false },
  });

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const fileBuffer = await readDocumentObject({
    provider: doc.storageProvider,
    key: doc.storageKey,
    data: doc.data,
  });

  const body = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(doc.sizeBytes || fileBuffer.length),
      "Content-Disposition": `inline; filename="${contentDispositionFileName(doc.fileName)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
