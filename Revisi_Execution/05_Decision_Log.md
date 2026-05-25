# Decision Log

This file records product and technical decisions so future AI/developer work does not accidentally reverse them.

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Impact
- Related SRS / execution file
- Reversal rule if any

## Decisions

### 2026-05-23 - Two Documentation Systems

Decision:

- Use `SRS_CoalTrade_OS_Revisi` as product requirement source.
- Use `Revisi_Execution` as execution ledger and AI working guide.

Reason:

- SRS alone says what to build but not what code already has.
- Execution docs prevent AI from overwriting completed work.

Impact:

- Every significant implementation should update Revisi Execution.
- Scope changes should update SRS and Revisi Execution.

Related:

- `Revisi_Execution/00_README.md`
- `Revisi_Execution/01_AI_Working_Protocol.md`

### 2026-05-23 - Projects Renamed To Forecast Sales

Decision:

- Product-facing module name must be `Forecast Sales`.
- Legacy code/database names such as `ProjectItem`, `/projects`, or `projects` may remain temporarily for compatibility.

Reason:

- User clarified Project is actually forecast/offer workflow before shipment.
- Direct database rename is risky until workflow is stabilized.

Impact:

- UI labels should be renamed first.
- Data compatibility should be preserved.
- Future models may introduce `ForecastSales` while mapping old `ProjectItem`.

Related:

- `SRS_CoalTrade_OS_Revisi/08_Forecast_Sales_FCO_Revision.md`
- `Revisi_Execution/03_Execution_Backlog.md` FS-001

### 2026-05-23 - FCO Is Generated, Not Manual Primary Upload

Decision:

- FCO should be generated from approved Forecast Sales.
- FCO cannot be downloaded/generated before approval.

Reason:

- User provided FCO sample and requested generator workflow.
- Approval gate prevents unauthorized offer document.

Impact:

- Need FCO number, PDF template, status, sent date, buyer feedback.
- Any manual upload of FCO should be secondary attachment, not source of truth.

Related:

- FR-FS-006
- FR-FS-007

### 2026-05-23 - Shipment Documents Must Be Preserved

Decision:

- Existing shipment document upload/download/ZIP functionality must be preserved.
- Future Document Checklist should extend it instead of replacing it blindly.

Reason:

- Current upload behavior already solves important user requests.
- Replacing it risks breaking production/testing workflow.

Impact:

- Add checklist item model around current file records.
- Keep document groups required/additional/critical.
- Keep critical access restriction.

Related:

- `Revisi_Execution/04_Module_Implementation_Status.md`
- `SRS_CoalTrade_OS_Revisi/04_Document_Management.md`

### 2026-05-23 - File Storage Current vs Production

Decision:

- Current DB `Bytes` storage is acceptable for testing.
- Production should migrate to object storage such as Vercel Blob, Supabase Storage, S3, or Cloudflare R2.

Reason:

- DB file bytes can slow response and increase database pressure.
- Production file lifecycle needs storage keys, metadata, versioning, and access control.

Impact:

- Do not remove DB storage until object storage migration exists.
- New document model should be storage-provider ready.

Related:

- Document Management SRS.

### 2026-05-23 - No-Overwrite Revision Principle

Decision:

- Source changes, barge changes, SI revisions, FCO revisions, and price/laycan revisions must never overwrite old state without history.

Reason:

- SRS explicitly requires traceability and active versions.

Impact:

- Add revision/request models rather than only updating current fields.
- Keep old values and active version.

Related:

- CP-03 in SRS master.
- FR-SCT-001, FR-BCL-001, FR-SI-002, FR-FS-011.

## Open Decisions

| Topic | Options | Needed before |
|---|---|---|
| Forecast Sales database strategy | Extend ProjectItem vs create ForecastSales models | Deep FS implementation |
| FCO PDF library | Existing jsPDF pattern vs server-side PDF generation | FCO generator |
| Approval model | Generic ApprovalRequest vs per-module approval tables | FCO/SI/source change |
| Production file storage | Vercel Blob vs Supabase Storage vs S3/R2 | Production deployment of document module |
| Route naming | Keep `/projects` while label Forecast Sales vs add `/forecast-sales` route | UI rename |
