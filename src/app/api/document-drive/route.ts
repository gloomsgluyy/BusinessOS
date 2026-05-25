import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DriveDocument = {
  id: string;
  sourceType: "forecast" | "shipment" | "daily_delivery" | "shipping_instruction";
  ownerId: string;
  ownerName: string;
  buyer?: string | null;
  documentGroup?: string | null;
  documentType?: string | null;
  title: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  uploadedByName?: string | null;
  createdAt: Date;
  url: string;
  isCritical?: boolean;
};

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function includesQuery(doc: DriveDocument, q: string) {
  if (!q) return true;
  const haystack = [
    doc.ownerName,
    doc.buyer,
    doc.documentGroup,
    doc.documentType,
    doc.title,
    doc.fileName,
    doc.uploadedByName,
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function matchesGroup(doc: DriveDocument, group: string) {
  if (!group || group === "all") return true;
  return [
    doc.documentGroup,
    doc.documentType,
  ].some((value) => String(value || "").toLowerCase() === group);
}

async function tableExists(table: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ reg: string | null }>>(
    `SELECT to_regclass('public."${table.replace(/"/g, "")}"')::text AS reg`,
  );
  return Boolean(rows[0]?.reg);
}

function compactLabel(value: unknown, fallback = "Document") {
  return cleanText(value, fallback)
    .replace(/^COPY OF\s+/i, "")
    .replace(/^1\s+ORIGINAL\s+/i, "")
    .replace(/^3\/3\s+ORIGINAL\s+/i, "")
    .replace(/\s+ISSUED BY .+$/i, "")
    .trim() || fallback;
}

function driveTitle(parts: Array<string | null | undefined>) {
  return parts.map((part) => cleanText(part)).filter(Boolean).join(" - ");
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const url = new URL(req.url);
    const q = cleanText(url.searchParams.get("q")).toLowerCase();
    const source = cleanText(url.searchParams.get("source"), "all").toLowerCase();
    const group = cleanText(url.searchParams.get("group"), "all").toLowerCase();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 120), 1), 300);
    const perSourceLimit = Math.min(limit, 100);
    const canReadCritical = Boolean(session?.user && isExecutiveRole(session.user.role));

    const [hasProjectDocumentTable, hasShipmentDocumentTable, hasDailyDocumentTable, hasSiTable] = await Promise.all([
      tableExists("ProjectDocument"),
      tableExists("ShipmentDocument"),
      tableExists("DailyDeliveryDocument"),
      tableExists("ShippingInstructionRecord"),
    ]);

    const [projectDocs, shipmentDocs, dailyDocs, siDocs] = await Promise.all([
      hasProjectDocumentTable && (source === "all" || source === "forecast")
        ? prisma.projectDocument.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: perSourceLimit,
          select: {
            id: true,
            projectId: true,
            requirementCode: true,
            requirementLabel: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            uploadedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
      hasShipmentDocumentTable && (source === "all" || source === "shipment")
        ? prisma.shipmentDocument.findMany({
          where: {
            isDeleted: false,
            ...(canReadCritical ? {} : { documentGroup: { not: "critical" } }),
            ...(group !== "all" ? { documentGroup: group } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: perSourceLimit,
          select: {
            id: true,
            shipmentId: true,
            documentGroup: true,
            requirementCode: true,
            requirementLabel: true,
            title: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            uploadedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
      hasDailyDocumentTable && (source === "all" || source === "daily_delivery")
        ? prisma.dailyDeliveryDocument.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: perSourceLimit,
          select: {
            id: true,
            dailyDeliveryId: true,
            documentType: true,
            title: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            uploadedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
      hasSiTable && (source === "all" || source === "shipping_instruction" || source === "shipment")
        ? prisma.shippingInstructionRecord.findMany({
          where: {
            isDeleted: false,
            status: { notIn: ["cancelled", "rejected"] },
          },
          orderBy: { createdAt: "desc" },
          take: perSourceLimit,
          select: {
            id: true,
            shipmentId: true,
            siNumber: true,
            version: true,
            status: true,
            pdfFileName: true,
            generatedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
    ]);

    const projectIds = Array.from(new Set(projectDocs.map((doc) => doc.projectId)));
    const shipmentIds = Array.from(new Set([...shipmentDocs.map((doc) => doc.shipmentId), ...siDocs.map((doc) => doc.shipmentId)]));
    const dailyIds = Array.from(new Set(dailyDocs.map((doc) => doc.dailyDeliveryId)));

    const [projects, shipments, dailyDeliveries] = await Promise.all([
      projectIds.length
        ? prisma.projectItem.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true, buyer: true, createdByName: true },
        })
        : Promise.resolve([]),
      shipmentIds.length
        ? prisma.shipmentDetail.findMany({
          where: { id: { in: shipmentIds } },
          select: { id: true, mvProjectName: true, forecastSalesName: true, vesselName: true, bargeName: true, nomination: true, buyer: true },
        })
        : Promise.resolve([]),
      dailyIds.length
        ? prisma.dailyDelivery.findMany({
          where: { id: { in: dailyIds } },
          select: { id: true, project: true, mvBargeNomination: true, buyer: true, supplier: true },
        })
        : Promise.resolve([]),
    ]);

    const projectById = new Map(projects.map((item) => [item.id, item]));
    const shipmentById = new Map(shipments.map((item) => [item.id, item]));
    const dailyById = new Map(dailyDeliveries.map((item) => [item.id, item]));

    const documents: DriveDocument[] = [
      ...projectDocs.map((doc) => {
        const project = projectById.get(doc.projectId);
        return {
          id: doc.id,
          sourceType: "forecast" as const,
          ownerId: doc.projectId,
          ownerName: project?.name || doc.projectId,
          buyer: project?.buyer || null,
          documentGroup: "forecast",
          documentType: doc.requirementCode || "forecast_document",
          title: driveTitle(["Forecast Sales", project?.name || doc.projectId, compactLabel(doc.requirementLabel), project?.buyer]),
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          uploadedByName: doc.uploadedByName || project?.createdByName || null,
          createdAt: doc.createdAt,
          url: `/api/document-drive/files/forecast/${doc.projectId}/${doc.id}`,
          isCritical: false,
        };
      }),
      ...shipmentDocs.map((doc) => {
        const shipment = shipmentById.get(doc.shipmentId);
        return {
          id: doc.id,
          sourceType: "shipment" as const,
          ownerId: doc.shipmentId,
          ownerName: shipment?.forecastSalesName || shipment?.mvProjectName || shipment?.vesselName || shipment?.bargeName || shipment?.nomination || doc.shipmentId,
          buyer: shipment?.buyer || null,
          documentGroup: doc.documentGroup,
          documentType: doc.requirementCode || doc.requirementLabel || doc.title,
          title: driveTitle([
            shipment?.forecastSalesName || shipment?.mvProjectName || shipment?.vesselName || shipment?.nomination || doc.shipmentId,
            compactLabel(doc.requirementLabel || doc.title),
            shipment?.buyer,
            doc.documentGroup,
          ]),
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          uploadedByName: doc.uploadedByName,
          createdAt: doc.createdAt,
          url: `/api/document-drive/files/shipment/${doc.shipmentId}/${doc.id}`,
          isCritical: doc.documentGroup === "critical",
        };
      }),
      ...dailyDocs.map((doc) => {
        const daily = dailyById.get(doc.dailyDeliveryId);
        return {
          id: doc.id,
          sourceType: "daily_delivery" as const,
          ownerId: doc.dailyDeliveryId,
          ownerName: daily?.project || daily?.mvBargeNomination || daily?.supplier || doc.dailyDeliveryId,
          buyer: daily?.buyer || null,
          documentGroup: "domestic_handover",
          documentType: doc.documentType,
          title: driveTitle([daily?.project || daily?.mvBargeNomination || daily?.supplier || doc.dailyDeliveryId, compactLabel(doc.title), doc.documentType]),
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          uploadedByName: doc.uploadedByName,
          createdAt: doc.createdAt,
          url: `/api/document-drive/files/daily_delivery/${doc.dailyDeliveryId}/${doc.id}`,
          isCritical: false,
        };
      }),
      ...siDocs.map((doc) => {
        const shipment = shipmentById.get(doc.shipmentId);
        const ownerName = shipment?.forecastSalesName || shipment?.mvProjectName || shipment?.vesselName || shipment?.bargeName || shipment?.nomination || doc.shipmentId;
        const fileName = doc.pdfFileName || `${doc.siNumber}-v${doc.version}.pdf`;
        return {
          id: doc.id,
          sourceType: "shipping_instruction" as const,
          ownerId: doc.shipmentId,
          ownerName,
          buyer: shipment?.buyer || null,
          documentGroup: "shipping_instruction",
          documentType: "shipping_instruction",
          title: driveTitle([ownerName, `Shipping Instruction ${doc.siNumber}`, `v${doc.version}`, shipment?.buyer]),
          fileName,
          mimeType: "application/pdf",
          sizeBytes: 0,
          uploadedByName: doc.generatedByName || "System Generated",
          createdAt: doc.createdAt,
          url: `/api/document-drive/files/shipping_instruction/${doc.shipmentId}/${doc.id}`,
          isCritical: false,
        };
      }),
    ]
      .filter((doc) => includesQuery(doc, q))
      .filter((doc) => matchesGroup(doc, group))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    const summary = {
      total: documents.length,
      forecast: documents.filter((doc) => doc.sourceType === "forecast").length,
      shipment: documents.filter((doc) => doc.sourceType === "shipment").length,
      dailyDelivery: documents.filter((doc) => doc.sourceType === "daily_delivery").length,
      shippingInstruction: documents.filter((doc) => doc.sourceType === "shipping_instruction").length,
      required: documents.filter((doc) => doc.documentGroup === "required").length,
      additional: documents.filter((doc) => doc.documentGroup === "additional").length,
      domestic: documents.filter((doc) => doc.documentGroup === "domestic_handover").length,
    };

    return NextResponse.json({ success: true, summary, documents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/document-drive error:", error);
    return NextResponse.json({ error: "Failed to load document drive" }, { status: 500 });
  }
}
