ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmationStatus" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmationDocumentId" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmationNotes" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmedBy" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmedByName" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmedAt" TIMESTAMP(3);
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceLegalReadinessStatus" TEXT;
ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceCargoReadinessStatus" TEXT;
