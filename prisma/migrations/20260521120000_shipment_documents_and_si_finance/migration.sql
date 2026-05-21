ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "buyingPrice" DOUBLE PRECISION;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "siTo" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "siShipper" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "consignee" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "consigneeAddress" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "notifyParty" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "notifyPartyAddress" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "siMarked" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "quantityTolerance" TEXT;

CREATE TABLE IF NOT EXISTS "ShipmentDocument" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "documentGroup" TEXT NOT NULL,
  "requirementCode" TEXT,
  "requirementLabel" TEXT,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "data" BYTEA NOT NULL,
  "uploadedBy" TEXT,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ShipmentDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShipmentDocument_shipmentId_idx" ON "ShipmentDocument"("shipmentId");
CREATE INDEX IF NOT EXISTS "ShipmentDocument_shipmentId_documentGroup_idx" ON "ShipmentDocument"("shipmentId", "documentGroup");
