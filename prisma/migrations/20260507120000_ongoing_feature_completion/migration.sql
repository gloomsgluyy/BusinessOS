-- Persist ongoing feature completion fields.
ALTER TABLE "ShipmentDetail"
  ADD COLUMN IF NOT EXISTS "operationalInfo" TEXT,
  ADD COLUMN IF NOT EXISTS "demurrageRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "demurrageCurrency" TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "demurrageSource" TEXT,
  ADD COLUMN IF NOT EXISTS "demurrageUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ProjectItem"
  ADD COLUMN IF NOT EXISTS "templateType" TEXT,
  ADD COLUMN IF NOT EXISTS "templateChecklist" TEXT,
  ADD COLUMN IF NOT EXISTS "urgencyScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "urgencyLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "urgencyReport" TEXT,
  ADD COLUMN IF NOT EXISTS "lastUrgencyAnalyzedAt" TIMESTAMP(3);

ALTER TABLE "Partner"
  ADD COLUMN IF NOT EXISTS "legalDocumentName" TEXT,
  ADD COLUMN IF NOT EXISTS "legalExpiryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legalReminderDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "legalStatus" TEXT;
