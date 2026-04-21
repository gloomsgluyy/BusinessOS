/*
  Warnings:

  - You are about to drop the column `dealId` on the `ShipmentDetail` table. All the data in the column will be lost.
  - You are about to drop the column `isBlending` on the `ShipmentDetail` table. All the data in the column will be lost.
  - You are about to drop the column `milestones` on the `ShipmentDetail` table. All the data in the column will be lost.
  - You are about to drop the column `shipmentNumber` on the `ShipmentDetail` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CEO', 'DIRUT', 'ASS_DIRUT', 'COO', 'QQ_MANAGER', 'ADMIN_OPERATION', 'CMO', 'TRADERS_1', 'TRADERS_2_CPPO', 'TRADERS_3_COO', 'TRADERS_4_CMO', 'JUNIOR_TRADER', 'TRAFFIC_HEAD', 'TRAFFIC_TEAM_1', 'TRAFFIC_TEAM_2', 'TRAFFIC_TEAM_3', 'TRAFFIC_TEAM_4', 'ADMIN_MARKETING', 'QC_MANAGER', 'QC_ADMIN_1', 'QC_ADMIN_2', 'CPPO', 'SPV_SOURCING', 'SOURCING_OFFICER_1', 'SOURCING_OFFICER_2', 'SOURCING_OFFICER_3', 'SOURCING_OFFICER_4', 'STAFF');

-- DropIndex
DROP INDEX "ShipmentDetail_shipmentNumber_key";

-- AlterTable
ALTER TABLE "MarketPrice" ADD COLUMN     "avg2WeeksIci1" DOUBLE PRECISION,
ADD COLUMN     "avg4WeeksIci1" DOUBLE PRECISION,
ADD COLUMN     "avgMonthlyIci1" DOUBLE PRECISION,
ADD COLUMN     "changeWeekly" DOUBLE PRECISION,
ADD COLUMN     "hbaI" DOUBLE PRECISION,
ADD COLUMN     "hbaII" DOUBLE PRECISION,
ADD COLUMN     "hbaIII" DOUBLE PRECISION,
ADD COLUMN     "hpbValue" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ShipmentDetail" DROP COLUMN "dealId",
DROP COLUMN "isBlending",
DROP COLUMN "milestones",
DROP COLUMN "shipmentNumber",
ADD COLUMN     "allowance" TEXT,
ADD COLUMN     "analysisMethod" TEXT,
ADD COLUMN     "coaDate" TIMESTAMP(3),
ADD COLUMN     "completelyLoaded" TIMESTAMP(3),
ADD COLUMN     "deadfreight" DOUBLE PRECISION,
ADD COLUMN     "demm" TEXT,
ADD COLUMN     "exportDmo" TEXT,
ADD COLUMN     "hargaActualFob" DOUBLE PRECISION,
ADD COLUMN     "hargaActualFobMv" DOUBLE PRECISION,
ADD COLUMN     "hpb" DOUBLE PRECISION,
ADD COLUMN     "issueNotes" TEXT,
ADD COLUMN     "jarak" DOUBLE PRECISION,
ADD COLUMN     "jettyLoadingPort" TEXT,
ADD COLUMN     "kuotaExport" TEXT,
ADD COLUMN     "laycan" TEXT,
ADD COLUMN     "lhvTerbit" TIMESTAMP(3),
ADD COLUMN     "lossGainCargo" DOUBLE PRECISION,
ADD COLUMN     "mvProjectName" TEXT,
ADD COLUMN     "no" INTEGER,
ADD COLUMN     "noInvoiceMkls" TEXT,
ADD COLUMN     "noSi" TEXT,
ADD COLUMN     "noSpal" TEXT,
ADD COLUMN     "nomination" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "pic" TEXT,
ADD COLUMN     "priceFreight" DOUBLE PRECISION,
ADD COLUMN     "product" TEXT,
ADD COLUMN     "qtyCob" DOUBLE PRECISION,
ADD COLUMN     "qtyPlan" DOUBLE PRECISION,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "resultGar" DOUBLE PRECISION,
ADD COLUMN     "sentToBargeOwner" TEXT,
ADD COLUMN     "sentToSupplier" TEXT,
ADD COLUMN     "shipmentFlow" TEXT,
ADD COLUMN     "shipmentStatus" TEXT,
ADD COLUMN     "shippingRate" DOUBLE PRECISION,
ADD COLUMN     "shippingTerm" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sp" DOUBLE PRECISION,
ADD COLUMN     "statusHpb" TEXT,
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "surveyorLhv" TEXT,
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT 2026,
ALTER COLUMN "status" SET DEFAULT 'upcoming',
ALTER COLUMN "buyer" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SourceSupplier" ADD COLUMN     "dokumenFlow" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "psaResultGar" DOUBLE PRECISION,
ADD COLUMN     "qtyProduction" DOUBLE PRECISION,
ADD COLUMN     "specGar" DOUBLE PRECISION,
ADD COLUMN     "statusDetail" TEXT,
ADD COLUMN     "updatedDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STAFF';

-- CreateTable
CREATE TABLE "DailyDelivery" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'domestic',
    "year" INTEGER NOT NULL DEFAULT 2026,
    "shipmentStatus" TEXT,
    "buyer" TEXT,
    "pod" TEXT,
    "shippingTerm" TEXT,
    "latestEtaPod" TIMESTAMP(3),
    "arriveAtPod" TIMESTAMP(3),
    "keterlambatan" TEXT,
    "pol" TEXT,
    "laycanPol" TEXT,
    "area" TEXT,
    "supplier" TEXT,
    "mvBargeNomination" TEXT,
    "issue" TEXT,
    "blMonth" TEXT,
    "blQuantity" DOUBLE PRECISION,
    "blDate" TIMESTAMP(3),
    "analysisMethod" TEXT,
    "surveyorPol" TEXT,
    "surveyorPod" TEXT,
    "project" TEXT,
    "flow" TEXT,
    "terpal" TEXT,
    "insurance" TEXT,
    "basePrice" DOUBLE PRECISION,
    "basePriceNotes" TEXT,
    "poMonth" TEXT,
    "product" TEXT,
    "arriveAtPol" TIMESTAMP(3),
    "commenceLoading" TIMESTAMP(3),
    "completeLoading" TIMESTAMP(3),
    "startDischarging" TIMESTAMP(3),
    "completeDischarged" TIMESTAMP(3),
    "podQuantity" DOUBLE PRECISION,
    "lossGainCargo" DOUBLE PRECISION,
    "poNo" TEXT,
    "contractNo" TEXT,
    "contractType" TEXT,
    "invoicePrice" DOUBLE PRECISION,
    "invoiceAmount" DOUBLE PRECISION,
    "paymentDueDate" TIMESTAMP(3),
    "paymentStatus" TEXT,
    "specContract" TEXT,
    "actualGcvGar" DOUBLE PRECISION,
    "actualTs" DOUBLE PRECISION,
    "actualAsh" DOUBLE PRECISION,
    "actualTm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutstandingPayment" (
    "id" TEXT NOT NULL,
    "perusahaan" TEXT NOT NULL,
    "kodeBatu" TEXT,
    "priceInclPph" DOUBLE PRECISION,
    "qty" DOUBLE PRECISION,
    "totalDp" DOUBLE PRECISION,
    "calculationDate" TIMESTAMP(3),
    "dpToShipment" TIMESTAMP(3),
    "timeframeDays" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "year" INTEGER NOT NULL DEFAULT 2026,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OutstandingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT,
    "buyer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting_approval',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "approvedBy" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
);
