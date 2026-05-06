-- AlterTable
ALTER TABLE "ShipmentDetail" ADD COLUMN     "lastAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskReport" TEXT,
ADD COLUMN     "riskScore" INTEGER;
