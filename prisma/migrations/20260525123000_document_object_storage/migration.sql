ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;

ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;
ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "ShipmentDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;

ALTER TABLE "DailyDeliveryDocument" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;
ALTER TABLE "DailyDeliveryDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "DailyDeliveryDocument" ADD COLUMN IF NOT EXISTS "storageUrl" TEXT;

CREATE INDEX IF NOT EXISTS "ProjectDocument_storageProvider_idx" ON "ProjectDocument"("storageProvider");
CREATE INDEX IF NOT EXISTS "ShipmentDocument_storageProvider_idx" ON "ShipmentDocument"("storageProvider");
CREATE INDEX IF NOT EXISTS "DailyDeliveryDocument_storageProvider_idx" ON "DailyDeliveryDocument"("storageProvider");
