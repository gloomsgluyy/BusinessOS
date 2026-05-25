CREATE TABLE IF NOT EXISTS "ProjectSupplierCandidate" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceId" TEXT,
  "supplierName" TEXT NOT NULL,
  "sourceName" TEXT,
  "region" TEXT,
  "fitScore" INTEGER,
  "warningText" TEXT,
  "stockAvailable" DOUBLE PRECISION,
  "gar" DOUBLE PRECISION,
  "tm" DOUBLE PRECISION,
  "ts" DOUBLE PRECISION,
  "ash" DOUBLE PRECISION,
  "priceUsd" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'candidate',
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdByName" TEXT,
  "selectedBy" TEXT,
  "selectedByName" TEXT,
  "selectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ProjectSupplierCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectSupplierCandidate_projectId_idx" ON "ProjectSupplierCandidate"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectSupplierCandidate_projectId_selected_idx" ON "ProjectSupplierCandidate"("projectId", "selected");
CREATE INDEX IF NOT EXISTS "ProjectSupplierCandidate_projectId_status_idx" ON "ProjectSupplierCandidate"("projectId", "status");
