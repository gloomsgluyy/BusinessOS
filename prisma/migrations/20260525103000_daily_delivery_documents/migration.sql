CREATE TABLE IF NOT EXISTS "DailyDeliveryDocument" (
  "id" TEXT NOT NULL,
  "dailyDeliveryId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "data" BYTEA NOT NULL,
  "uploadedBy" TEXT,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "DailyDeliveryDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DailyDeliveryDocument_dailyDeliveryId_idx" ON "DailyDeliveryDocument"("dailyDeliveryId");
CREATE INDEX IF NOT EXISTS "DailyDeliveryDocument_dailyDeliveryId_documentType_idx" ON "DailyDeliveryDocument"("dailyDeliveryId", "documentType");
