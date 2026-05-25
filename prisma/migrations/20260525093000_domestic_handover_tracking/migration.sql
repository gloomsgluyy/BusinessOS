ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabSupplierSentAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabOperationReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabOperationSentAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabTrafficReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabTrafficSentFinanceAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabFinanceReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabEvidenceDocumentId" TEXT;
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "skabNotes" TEXT;

ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "dsrSupplierSentAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "dsrOperationReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "dsrOperationSentAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "dsrTrafficReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "dsrEvidenceDocumentId" TEXT;

ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "blCmOperationSentAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "blCmTrafficReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "blCmTrafficSentFinanceAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "blCmFinanceReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "blCmEvidenceDocumentId" TEXT;

ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPolDate" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPolSurveyorSentAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPolTrafficReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPolFinanceReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPolEvidenceDocumentId" TEXT;

ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPodReceivedAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "financeSubmitFullSetAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "vendorReceivedFullSetAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "approvalDtAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "vendorPaidAt" TIMESTAMP(3);
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "coaPodEvidenceDocumentId" TEXT;
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "fullSetDocumentStatus" TEXT;
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "hardcopyStatus" TEXT;
ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "softcopyStatus" TEXT;
