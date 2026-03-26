-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'staff',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ChatHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingMedia" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "transcribedText" TEXT,
    "generatedMom" TEXT,
    "extractedTasks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineMilestone" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastSyncTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "imageUrl" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplier" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "imageUrl" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyReason" TEXT,
    "ocrData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentDetail" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "dealId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "buyer" TEXT NOT NULL,
    "supplier" TEXT,
    "isBlending" BOOLEAN NOT NULL DEFAULT false,
    "iupOp" TEXT,
    "vesselName" TEXT,
    "bargeName" TEXT,
    "loadingPort" TEXT,
    "dischargePort" TEXT,
    "quantityLoaded" DOUBLE PRECISION,
    "blDate" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "salesPrice" DOUBLE PRECISION,
    "marginMt" DOUBLE PRECISION,
    "picName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'export',
    "milestones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShipmentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "calorieRange" TEXT,
    "gar" DOUBLE PRECISION,
    "ts" DOUBLE PRECISION,
    "ash" DOUBLE PRECISION,
    "tm" DOUBLE PRECISION,
    "im" DOUBLE PRECISION,
    "fc" DOUBLE PRECISION,
    "nar" DOUBLE PRECISION,
    "adb" DOUBLE PRECISION,
    "jettyPort" TEXT,
    "anchorage" TEXT,
    "stockAvailable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockAlert" DOUBLE PRECISION,
    "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
    "psiStatus" TEXT NOT NULL DEFAULT 'not_started',
    "fobBargeOnly" BOOLEAN NOT NULL DEFAULT false,
    "priceLinkedIndex" TEXT,
    "fobBargePriceUsd" DOUBLE PRECISION,
    "contractType" TEXT,
    "picName" TEXT,
    "iupNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SourceSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityResult" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "cargoName" TEXT NOT NULL,
    "surveyor" TEXT,
    "samplingDate" TIMESTAMP(3),
    "gar" DOUBLE PRECISION,
    "ts" DOUBLE PRECISION,
    "ash" DOUBLE PRECISION,
    "tm" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QualityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ici1" DOUBLE PRECISION,
    "ici2" DOUBLE PRECISION,
    "ici3" DOUBLE PRECISION,
    "ici4" DOUBLE PRECISION,
    "ici5" DOUBLE PRECISION,
    "newcastle" DOUBLE PRECISION,
    "hba" DOUBLE PRECISION,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "time" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "attendees" TEXT,
    "momContent" TEXT,
    "voiceNoteUrl" TEXT,
    "aiSummary" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MeetingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PLForecast" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "dealNumber" TEXT,
    "projectName" TEXT,
    "buyer" TEXT,
    "type" TEXT NOT NULL DEFAULT 'export',
    "status" TEXT NOT NULL DEFAULT 'forecast',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buyingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freightCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfitMt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalGrossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PLForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDeal" (
    "id" TEXT NOT NULL,
    "dealNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pre_sale',
    "buyer" TEXT NOT NULL,
    "buyerCountry" TEXT,
    "type" TEXT NOT NULL DEFAULT 'export',
    "shippingTerms" TEXT NOT NULL DEFAULT 'FOB',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerMt" DOUBLE PRECISION,
    "totalValue" DOUBLE PRECISION,
    "laycanStart" TIMESTAMP(3),
    "laycanEnd" TIMESTAMP(3),
    "vesselName" TEXT,
    "gar" DOUBLE PRECISION,
    "ts" DOUBLE PRECISION,
    "ash" DOUBLE PRECISION,
    "tm" DOUBLE PRECISION,
    "projectId" TEXT,
    "picId" TEXT,
    "picName" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SalesDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'buyer',
    "category" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "taxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlendingSimulation" (
    "id" TEXT NOT NULL,
    "inputs" TEXT NOT NULL DEFAULT '[]',
    "totalQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultGar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultTs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultAsh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultTm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlendingSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNumber_key" ON "SalesOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_requestNumber_key" ON "PurchaseRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentDetail_shipmentNumber_key" ON "ShipmentDetail"("shipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDeal_dealNumber_key" ON "SalesDeal"("dealNumber");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatHistory" ADD CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMedia" ADD CONSTRAINT "MeetingMedia_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
