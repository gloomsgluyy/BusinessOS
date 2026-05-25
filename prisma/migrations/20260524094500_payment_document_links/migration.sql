ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceDocumentId" TEXT;
ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "paymentProofDocumentId" TEXT;
