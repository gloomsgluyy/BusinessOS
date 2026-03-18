-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAFF'
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "transcribedText" TEXT,
    "generatedMom" TEXT,
    "extractedTasks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingMedia_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "lastSyncTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assigneeId" TEXT,
    "assigneeName" TEXT,
    "dueDate" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "description" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "imageUrl" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplier" TEXT,
    "description" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ShipmentDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "quantityLoaded" REAL,
    "blDate" DATETIME,
    "eta" DATETIME,
    "salesPrice" REAL,
    "marginMt" REAL,
    "picName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'export',
    "milestones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "SourceSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "calorieRange" TEXT,
    "gar" REAL,
    "ts" REAL,
    "ash" REAL,
    "tm" REAL,
    "jettyPort" TEXT,
    "anchorage" TEXT,
    "stockAvailable" REAL NOT NULL DEFAULT 0,
    "minStockAlert" REAL,
    "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
    "psiStatus" TEXT NOT NULL DEFAULT 'not_started',
    "fobBargeOnly" BOOLEAN NOT NULL DEFAULT false,
    "priceLinkedIndex" TEXT,
    "fobBargePriceUsd" REAL,
    "contractType" TEXT,
    "picName" TEXT,
    "iupNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "QualityResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cargoId" TEXT NOT NULL,
    "cargoName" TEXT NOT NULL,
    "surveyor" TEXT,
    "samplingDate" DATETIME,
    "gar" REAL,
    "ts" REAL,
    "ash" REAL,
    "tm" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "ici1" REAL,
    "ici2" REAL,
    "ici3" REAL,
    "ici4" REAL,
    "ici5" REAL,
    "newcastle" REAL,
    "hba" REAL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "MeetingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME,
    "time" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "attendees" TEXT,
    "momContent" TEXT,
    "voiceNoteUrl" TEXT,
    "aiSummary" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "PLForecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT,
    "dealNumber" TEXT,
    "projectName" TEXT,
    "buyer" TEXT,
    "type" TEXT NOT NULL DEFAULT 'export',
    "status" TEXT NOT NULL DEFAULT 'forecast',
    "quantity" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "buyingPrice" REAL NOT NULL DEFAULT 0,
    "freightCost" REAL NOT NULL DEFAULT 0,
    "otherCost" REAL NOT NULL DEFAULT 0,
    "grossProfitMt" REAL NOT NULL DEFAULT 0,
    "totalGrossProfit" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "SalesDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pre_sale',
    "buyer" TEXT NOT NULL,
    "buyerCountry" TEXT,
    "type" TEXT NOT NULL DEFAULT 'export',
    "shippingTerms" TEXT NOT NULL DEFAULT 'FOB',
    "quantity" REAL NOT NULL DEFAULT 0,
    "pricePerMt" REAL,
    "totalValue" REAL,
    "laycanStart" DATETIME,
    "laycanEnd" DATETIME,
    "vesselName" TEXT,
    "gar" REAL,
    "ts" REAL,
    "ash" REAL,
    "tm" REAL,
    "projectId" TEXT,
    "picId" TEXT,
    "picName" TEXT,
    "createdByName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "BlendingSimulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inputs" TEXT NOT NULL DEFAULT '[]',
    "totalQuantity" REAL NOT NULL DEFAULT 0,
    "resultGar" REAL NOT NULL DEFAULT 0,
    "resultTs" REAL NOT NULL DEFAULT 0,
    "resultAsh" REAL NOT NULL DEFAULT 0,
    "resultTm" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false
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
