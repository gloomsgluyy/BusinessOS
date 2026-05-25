CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "href" TEXT,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "requestedBy" TEXT,
    "requestedByName" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalRequest_kind_recordId_key" ON "ApprovalRequest"("kind", "recordId");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_kind_status_idx" ON "ApprovalRequest"("kind", "status");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_shipmentId_idx" ON "ApprovalRequest"("shipmentId");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_priority_slaDueAt_idx" ON "ApprovalRequest"("priority", "slaDueAt");
