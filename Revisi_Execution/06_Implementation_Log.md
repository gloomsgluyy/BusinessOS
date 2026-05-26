# Implementation Log

This file records completed work and verification notes. Add entries after code or major documentation changes.

## Entry Template

```md
## YYYY-MM-DD - Short Title

Type:

- Documentation / SRS / Code / Bugfix / Verification / Deploy

Changed:

- file path

SRS refs:

- FR-...

What changed:

- ...

Verification:

- command/result or manual verification

Remaining risk:

- ...
```

## 2026-05-23 - Revisi Execution Documentation System

Type:

- Documentation

Changed:

- `Revisi_Execution/00_README.md`
- `Revisi_Execution/01_AI_Working_Protocol.md`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/05_Decision_Log.md`
- `Revisi_Execution/06_Implementation_Log.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`
- `SRS_CoalTrade_OS_Revisi/00_README.md`

SRS refs:

- SRS package level documentation process.

What changed:

- Created execution guide folder for AI/developer work.
- Added current code vs SRS gap matrix.
- Added backlog with priority and definition of done.
- Added module implementation status.
- Added decision log.
- Added no-overwrite checklist.
- Linked SRS README to execution system.

Verification:

- Read-only code/SRS scan with `rg`.
- Confirmed current branch/status with `git status --short --branch`.

Remaining risk:

- Execution docs are initial snapshot and must be updated after each implementation.
- No application code was changed in this entry.

## 2026-05-23 - Forecast Sales SRS Revision

Type:

- SRS

Changed:

- `SRS_CoalTrade_OS_Revisi/08_Forecast_Sales_FCO_Revision.md`
- `SRS_CoalTrade_OS_Revisi/00_README.md`
- `SRS_CoalTrade_OS_Revisi/01_SRS_Master.md`
- `SRS_CoalTrade_OS_Revisi/02_Functional_Requirements.md`
- `SRS_CoalTrade_OS_Revisi/03_Module_Requirements.md`
- `SRS_CoalTrade_OS_Revisi/04_Document_Management.md`
- `SRS_CoalTrade_OS_Revisi/05_Roles_Status_Approval_Audit.md`
- `SRS_CoalTrade_OS_Revisi/06_Traceability_Matrix.md`
- `SRS_CoalTrade_OS_Revisi/07_Implementation_Roadmap_Acceptance.md`

SRS refs:

- FR-FS-001 to FR-FS-011.
- FR-SH-005.

What changed:

- Added Forecast Sales + FCO workflow.
- Added FCO generator requirement based on sample PDF.
- Added shipment data completeness requirement.
- Added traceability for price/laycan/supplier/FCO revisions.

Verification:

- Extracted text from `FCO.C2604 (1).pdf` using local Python `pypdf`.
- Ran `rg` across SRS to check new Forecast Sales references.

Remaining risk:

- SRS updated but application code not yet implemented.

## 2026-05-23 - FS-001 Forecast Sales Product-Facing Rename

Type:

- Code
- Documentation

Changed:

- `src/lib/constants.ts`
- `src/components/layout/header.tsx`
- `src/app/projects/page.tsx`
- `src/app/sales-monitor/page.tsx`
- `src/app/shipment-monitor/page.tsx`
- `src/app/page.tsx`
- `src/app/pl-forecast/client.tsx`
- `src/components/chatbot/ai-chatbot.tsx`
- `src/app/api/memory/projects/route.ts`
- `src/app/api/projects/[id]/documents/route.ts`
- `src/app/api/projects/urgent-analysis/route.ts`
- `src/app/sales-orders/page.tsx`
- `src/app/transshipment/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-001

What changed:

- Renamed primary product-facing `Projects` labels to `Forecast Sales`.
- Kept legacy route `/projects`, `ProjectItem`, `project_name`, and Google Sheet `Projects` compatibility untouched.
- Updated SI/Summary labels generated from the current Forecast Sales page.
- Updated dashboard, Sales Monitor, Shipment Monitor selector text, P&L labels, chatbot context, and API-facing error/report messages.

Verification:

- `npx tsc --noEmit` passed.
- `rg` confirms remaining `Project/Projects` references are compatibility/internal sheet names, comments, or code identifiers.

Remaining risk:

- No new Forecast Sales workflow fields were added yet.
- FCO generator, offer approval workflow, buyer feedback, and Deal -> Shipment conversion remain pending.

## 2026-05-23 - FS-002 FS-003 Forecast Sales Offer Profile Foundation

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-002

What changed:

- Added additive Forecast Sales offer fields to legacy `ProjectItem`: buyer country, commodity, quantity, laycan, port of loading, sales term, target selling price, price basis, payment terms, surveyor, coal specs, size, and supplier candidates.
- Updated API/store/type mapping so old records still load and new fields persist.
- Expanded Forecast Sales form with Save Draft and Submit Offer Profile actions.
- Submit Offer Profile blocks missing mandatory fields with a clear list; Save Draft remains allowed incomplete.
- Forecast Sales cards now show offer quantity/revenue/laycan when no shipment exists yet.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Approval workflow still lacks comments/history.
- Supplier candidates are text-only; source-linked candidate comparison is pending.
- FCO generator and buyer feedback workflow remain pending.

## 2026-05-23 - FS-004 Forecast Sales Approval Workflow

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-006

What changed:

- Added additive `approvalHistory` storage to `ProjectItem`.
- Forecast Sales approval actions now support approve, revision requested, and reject.
- Approval comment is mandatory for approve/revision/reject.
- Approval action is restricted to CEO/DIRUT/ASS_DIRUT.
- Approval history is shown in Forecast Sales detail modal.
- Existing `/projects`, SI PDF, summary PDF, and document behavior were preserved.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Approval history is stored as JSON text for compatibility; a normalized approval table can be introduced later if needed.
- FCO generator and buyer feedback workflow remain pending.

## 2026-05-23 - FS-005 FS-006 Basic FCO Generator And Approval Gate

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-007

What changed:

- Added additive `fcoNumber` and `fcoGeneratedAt` storage to `ProjectItem`.
- Added FCO download button in Forecast Sales detail.
- FCO download is blocked unless the offer profile is approved.
- Basic FCO PDF is generated from approved offer profile fields.
- Missing FCO number is generated uniquely and persisted before download.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- FCO PDF needs visual/content hardening against `FCO.C2604 (1).pdf`.
- FCO version/sent status and buyer feedback workflow remain pending.

## 2026-05-23 - FS-005 FCO Template Hardening

Type:

- Code
- Documentation

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-007

What changed:

- Updated FCO PDF generator to follow the provided `FCO.C2604 (1).pdf` structure.
- Added header fields: date, FCO number, buyer, attention.
- Added clauses A-N: commodity, quality, origin, quantity, laycan, POL, base price, price adjustment, shipping terms, loading rate, payment terms, surveyor, other terms, validity.
- Added coal quality table with GAR/TM/TS/Ash/VM/size values from the approved offer profile.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- FCO version/sent status and buyer feedback workflow remain pending.

## 2026-05-23 - FS-007 Buyer Feedback Flow

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-008

What changed:

- Added buyer feedback status fields to Forecast Sales.
- Added UI controls for FCO Sent, Waiting Feedback, Negotiation, Deal, and Failed.
- Failed feedback requires a reason.
- API enforces failed reason.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Failed offer CEO notification remains pending.
- Deal -> Shipment conversion remains pending.

## 2026-05-23 - FS-008 Failed Offer Notification and FS-009 Deal to Shipment Conversion

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/projects/page.tsx`
- `src/components/layout/header.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-008
- FR-FS-009
- FR-SH-003

What changed:

- Failed Forecast Sales offers now surface in the management header notification layer.
- Added additive Shipment link fields: `forecastSalesId`, `forecastSalesName`, and `fcoNumber`.
- Added Shipment API/store mapping for those fields without renaming existing shipment/project models.
- Added Deal -> Shipment action in Forecast Sales buyer feedback panel.
- When buyer feedback becomes Deal, the system creates or updates a linked Shipment row carrying buyer, commodity, planned quantity, laycan, port of loading, sales term, target selling price, payment note, surveyor, supplier candidate, PIC, and FCO number.
- Added an Open Shipment link back to Shipment Monitor for linked rows.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Shipment Monitor still needs a dedicated commercial reference panel and data completeness score.
- Current conversion creates one linked shipment row per Forecast Sales; multi-shipment split/nominations are still future work.
- FCO sent evidence/version history remains pending.

## 2026-05-23 - FS-010 Forecast Sales Dashboard Cards

Type:

- Code
- Documentation

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-010

What changed:

- Added Forecast Sales dashboard KPI band above the record list.
- Cards include total forecast, draft, CEO review, approved, FCO sent, buyer pending, deal, failed, revenue, and shipment GP.
- Revenue and shipment GP values are restricted to executive roles using the existing page role logic.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Dashboard cards are currently page-level; cross-module dashboard/control-tower cards are still pending.
- Revenue is estimated from offer quantity x target selling price until rough P&L automation is implemented.

## 2026-05-23 - FS-012 Source Candidate Picker and FS-013 Initial Fit Score

Type:

- Code
- Documentation

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-003

What changed:

- Forecast Sales form now reads Source records from the commercial store.
- Added ranked Source candidate list based on target GAR/TM/TS/Ash, requested quantity, stock, KYC, and PSI status.
- Trader can click a Source candidate to append it into supplier candidate notes.
- Candidate row shows fit score, stock, spec summary, and warning text when quality/stock is below target.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Candidate selection is still stored in existing text field for compatibility.
- Need persistent structured candidate records, selected winner, and mandatory below-spec acknowledgement before final submit.

## 2026-05-23 - SH-002 Shipment Data Completeness Score

Type:

- Code
- Documentation

Changed:

- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SH-005

What changed:

- Added Shipment Data Completeness scoring helper with placeholder/empty-value detection.
- Card view now shows percent filled and first missing fields.
- List view now has a Filled column with tooltip of missing fields.
- Detail modal now shows data completeness card with progress bar, filled count, and missing field list.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Completeness field set is pragmatic and should be expanded when SRS shipment sub-tabs and closing checklist are formalized.

## 2026-05-24 - FS-011 Forecast Sales Critical Revision Log

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-011

What changed:

- Added additive `revisionHistory` field to `ProjectItem`.
- Project API now compares old/new critical values on update: quantity, laycan start, laycan end, target selling price, and supplier candidates.
- If values changed, API appends revision log with old value, new value, reason, user, timestamp, and status at time of change.
- Forecast Sales edit form now requires revision reason when critical fields change after draft.
- Forecast Sales detail modal displays the latest revision log entries.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Revision log is currently stored as JSON on `ProjectItem`; a first-class `RevisionLog` table may be better before heavy multi-entity audit/reporting.
- Approval reference is not yet linked to a generic approval request because that model is still future work.

## 2026-05-24 - FS-013/FS-014 Supplier Fit Warning and Below-Spec Acknowledgement

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-003

What changed:

- Added additive below-spec acknowledgement fields to `ProjectItem`.
- Forecast Sales form detects low-fit supplier candidate notes from Source picker.
- Submit Offer Profile is blocked when selected supplier candidates are below-spec/low-fit and no acknowledgement reason is provided.
- API enforces the same rule for `waiting_approval` submissions.
- Forecast Sales detail displays the acknowledgement reason and who/when acknowledged.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Candidate data still lives in the compatibility text field; persistent structured candidate rows and selected winner are future work.

## 2026-05-24 - SH-003 Shipment Commercial Reference Panel

Type:

- Code
- Documentation

Changed:

- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SH-003

What changed:

- Shipment detail modal now resolves linked Forecast Sales by `forecast_sales_id` or name fallback.
- Added Commercial Reference panel showing Forecast Sales name, FCO number, buyer feedback status, target/sales price, payment terms, surveyor, and source/supplier.
- Added Open Forecast Sales link so shipment users can jump back to the commercial offer source without reuploading FCO.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- This covers Forecast Sales/FCO reference only. MoM/PO references still need a formal commercial document/reference model.

## 2026-05-24 - FS-015 Embedded Forecast Sales Blending Simulation

Type:

- Code
- Documentation

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-004

What changed:

- Added embedded blending simulation inside the Forecast Sales form.
- Trader can allocate MT per ranked Source candidate.
- System calculates weighted final GAR, TM, TS, Ash, total quantity, and average FOB cost.
- Added auto split target action for quick initial scenario.
- Simulation warns when final blended result misses target quantity or quality limits.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Simulation is currently in-form only; FS-016 should persist selected scenario output to the Forecast Sales record.

## 2026-05-24 - FS-016 Save Blending Scenario to Forecast Sales

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-004

What changed:

- Added additive `blendingScenario` field to `ProjectItem`.
- Forecast Sales form can save the current embedded blending result to the offer.
- Saved scenario contains source inputs, quantities, source spec/cost, final weighted quality, average cost, warnings, and saved timestamp.
- Forecast Sales detail modal displays saved blending scenario summary.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Scenario is stored as JSON on `ProjectItem`; scenario versioning and selected supplier winner remain future work.

## 2026-05-24 - SI-001 Shipping Instruction Entity Foundation

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/shipping-instructions/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SI-001

What changed:

- Added `ShippingInstructionRecord` model.
- Added shipment SI API to list and create SI records per shipment.
- SI records store SI number, version, status, reason, snapshot, generated user, and timestamps.
- Shipment detail modal now shows SI version history and can record SI v1/revisions.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Marked Partial because generated SI PDF is not yet attached/version-linked to the SI entity.
- H-10/early approval and revision/cancellation workflow remain pending.

## 2026-05-24 - SI-002 H-10 Rule and Early Approval

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/shipping-instructions/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- BR-SI-001

What changed:

- Added early approval fields to `ShippingInstructionRecord`.
- SI creation checks shipment laycan. If SI is generated earlier than H-10, the API requires early approval reason and records status `early_pending_approval`.
- Shipment Monitor prompts for early approval reason before creating an early SI.
- Executives can approve/reject early SI directly from Shipment detail.
- Approval/rejection writes audit log entries.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Revision/cancellation workflow is still basic; SI-003 should formalize statuses, version behavior, and cancellation reasons.
- SI PDF is still generated from Project page and not attached to the SI record.

## 2026-05-24 - SI-003 SI Revision and Cancellation Workflow

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/shipping-instructions/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`

SRS refs:

- FR-SI-002

What changed:

- Added SI cancellation fields: reason, cancelled by, cancelled at.
- Creating a new SI revision now marks previous active version as `superseded` instead of overwriting/deleting it.
- Shipment Monitor can cancel an SI with mandatory cancellation reason.
- Cancellation writes audit log through the SI API.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- SI PDF is still not attached/version-linked to the SI entity.

## 2026-05-24 - DOC-002 Shipment Document Checklist Item Model

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/documents/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-001

What changed:

- Added additive `ShipmentDocumentChecklistItem` model so document requirements are tracked separately from uploaded file attachments.
- Document API now creates the checklist table if needed, seeds required SI-document requirements per shipment, and returns checklist items together with attachment records.
- Uploading a required document updates the matching checklist item to a received-style status while preserving the uploaded file as a separate `ShipmentDocument`.
- Shipment Monitor Required Documents cards now show checklist status, uploaded count, owner hint, and allow status updates without replacing uploaded files.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Expected/received/submitted dates, hardcopy, responsible party, aging alerts, and closing blockers still need UI completion in DOC-003 through DOC-005.
- Existing batch/project download still reads file attachments only; checklist status is not yet surfaced in the Forecast Sales download area.

## 2026-05-24 - DOC-003 Document Dates and Aging Visibility

Type:

- Code
- Documentation

Changed:

- `src/app/api/shipments/[id]/documents/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-001
- AG-001
- AG-002
- AG-003

What changed:

- Checklist PATCH now auto-fills received/submitted dates when status changes to received, submitted, or completed unless the UI sends explicit dates.
- Shipment Monitor Required Documents cards now expose expected, received, and submitted date inputs.
- Added aging chip per required checklist item:
  - pending target date,
  - due today / due in N days / overdue N days,
  - received aging,
  - submitted aging,
  - no aging for completed/not required.
- Checklist update remains separate from document upload/update/delete.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Dashboard aging alert is still pending under DOC-005.
- Owner/responsible party and hardcopy UI remain pending under DOC-004.

## 2026-05-24 - DOC-004 Owner, PIC, and Hardcopy Status

Type:

- Code
- Documentation

Changed:

- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-001

What changed:

- Required document checklist cards now expose owner role, PIC/responsible party, and hardcopy status.
- Hardcopy status supports pending, received, submitted, archived, and not required.
- Owner/PIC/hardcopy updates call the same checklist PATCH flow and remain separate from uploaded file records.
- Required document subtitle now surfaces owner and PIC for faster scanning.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Dashboard aging alert remains pending under DOC-005.
- Closing validation/blocker remains pending under SH-005 / closing checklist.

## 2026-05-24 - DOC-005 Dashboard Document Aging Alerts

Type:

- Code
- Documentation

Changed:

- `src/app/api/shipments/documents/aging-alerts/route.ts`
- `src/app/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-001
- AG-004

What changed:

- Added dashboard API for required document aging alerts, sourced from `ShipmentDocumentChecklistItem`.
- Alert logic covers:
  - pending required docs due today or overdue,
  - received docs not submitted after threshold,
  - submitted docs not completed after threshold,
  - rejected docs that need replacement.
- Dashboard now shows an executive-only Document Aging Alerts panel with critical/warning counts and links into Shipment Monitor detail.
- Alert panel displays shipment, requirement, owner, PIC, hardcopy status, status, and relevant dates.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Aging thresholds are currently fixed in code; SRS allows configurable thresholds later.
- Closing validation still needs to consume checklist status before shipment can close.

## 2026-05-24 - SH-005 Partial Closing Validation from Document Checklist

Type:

- Code
- Documentation

Changed:

- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- Closing Checklist
- FR-DOC-001

What changed:

- Shipment update API now blocks completed/done/closed status if required document checklist items are not submitted, completed, or not required.
- The API seeds default required checklist items before validating, so missing checklist setup cannot accidentally bypass closing.
- Shipment Monitor edit modal shows a closing blocker warning when the selected completed status conflicts with incomplete required docs.
- UI save also checks loaded checklist status before sending the update; backend remains the source of truth for all update paths.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.
- `GET http://localhost:3000/` returned 200.

Remaining risk:

- SH-005 is still partial. Quality, payment, approved SI, issue log, and revision blockers still need to be added before full closing validation is production complete.

## 2026-05-24 - SI-001 Completion with Version-Linked PDF

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/shipping-instructions/route.ts`
- `src/app/api/shipments/[id]/shipping-instructions/[recordId]/pdf/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SI-001

What changed:

- Added additive `pdfFileName` and `pdfGeneratedAt` fields to `ShippingInstructionRecord`.
- Creating SI v1/revision now records a PDF filename and generated timestamp for that SI version.
- SI API returns `pdfUrl` per record.
- Added download endpoint for `/api/shipments/[id]/shipping-instructions/[recordId]/pdf`, generating a PDF from the stored SI snapshot.
- Shipment Monitor SI version cards now show a Download SI PDF action per version.
- Existing Forecast Sales/Project SI download remains unchanged.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.
- `GET http://localhost:3000/` returned 200.

Remaining risk:

- The new SI record PDF is functional and version-linked, but visual parity should still be refined against the final SI template.
- Required-document filled counts are still richer in the legacy Project SI output than in the new record PDF route.

## 2026-05-24 - SH-005 SI Closing Blocker

Type:

- Code
- Documentation

Changed:

- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- Closing Checklist
- FR-SI-001

What changed:

- Shipment closing validation now also checks SI readiness.
- Completed/done/closed status is blocked if no SI record exists or the latest SI state is not represented by a generated/approved active record.
- Shipment Monitor edit modal shows SI blocker count alongside required document blocker count.
- Backend remains the source of truth for closing validation.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/shipment-monitor` returned 200.
- `GET http://localhost:3000/` returned 200.

Remaining risk:

- Closing validation still needs payment, quality, issue, and revision blockers.

## 2026-05-24 - FS-017 Restricted Rough P&L

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/memory/projects/route.ts`
- `src/store/commercial-store.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-005

What changed:

- Added additive `roughPnl` storage to `ProjectItem`.
- Forecast Sales create/update now generates a rough P&L snapshot from quantity, target selling price, saved blending average cost, or supplier candidate price hints.
- Forecast Sales detail modal now shows revenue, supplier price, variable cost, total cost, gross profit, margin/MT, margin %, and quantity only for CEO/DIRUT/ASS_DIRUT roles.
- Non-executive users see only a restricted notice, without financial values.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/projects` returned 200.
- `GET http://localhost:3000/` returned 200.
- Playwright opened `/projects`; only console error was existing `favicon.ico` 404.

Remaining risk:

- Rough P&L currently uses estimated/sparse cost signals; freight, royalty, tax, survey, payment, and selected supplier structured feeds still need integration.

## 2026-05-24 - SH-005 Payment Quality Issue Closing Blockers

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/store/commercial-store.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- Closing Checklist
- FR-SH-005
- FR-PAY-001
- FR-QLT-002

What changed:

- Added additive shipment readiness fields: `paymentStatus`, `paymentDueDate`, `qualityStatus`, and `issueStatus`.
- Shipment update API now blocks completed/done/closed status when payment/commercial data is incomplete, quality is not ready, or unresolved issue signals remain open.
- Commercial blockers check payment status, invoice number, quantity, sales price, and buying price.
- Quality blockers check linked quality results or shipment-level quality status plus COA/GAR evidence unless marked not required.
- Issue blockers detect pending/waiting/delay/claim/dispute signals in status reason, issue notes, or remarks, then require issue status to be resolved/closed/not required.
- Shipment Monitor edit modal now exposes payment status/due date, invoice number, quality status, and issue status controls.

Verification:

- `npx prisma generate` passed after restarting the local Next dev process that had locked Prisma client files.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.
- Playwright opened `/shipment-monitor` and redirected to login as expected; only console error was existing `favicon.ico` 404.

Remaining risk:

- SH-005 remains partial until structured issue log, source change, and barge change blockers exist.
- Outstanding Payment module is still not strongly linked to shipment records; current blocker uses shipment-level readiness fields.

## 2026-05-24 - DOC-006 Critical Document Replacement History

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/documents/route.ts`
- `src/app/api/shipments/[id]/documents/[docId]/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- UP-004
- FR-DOC-001

What changed:

- Added additive version/replacement metadata to `ShipmentDocument`: version, parent document, replaced-by document, replacement reason, replaced time, and replacing user.
- Critical document upload now checks for the latest active critical document with the same title.
- If a match exists, the new upload becomes the next version and the previous active document is marked `superseded` with replacement metadata.
- Superseded critical documents are retained and downloadable as history; metadata edit is blocked for superseded critical records.
- Shipment Monitor shows critical document version badges and marks superseded records as history.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.

Remaining risk:

- Replacement reason UI is implicit through notes/default text; later UX should add an explicit reason prompt when replacing a critical document.
- Production storage should move large uploaded file bytes out of DB into object storage.

## 2026-05-24 - SH-004 Structured Issue Log

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/issues/route.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SH-004
- Closing Checklist

What changed:

- Added `ShipmentIssueLog` model for shipment-specific issue category, impact, action, PIC, target date, status, evidence, notes, creator, and resolved timestamp.
- Added `/api/shipments/[id]/issues` GET/POST/PATCH route with role checks and audit log writes.
- Shipment detail overview now loads and displays structured issue logs.
- Traffic users can add issue logs and update issue status from Shipment Monitor.
- Shipment closing validation now blocks completed/done/closed status when open structured issue logs remain.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.

Remaining risk:

- Issue log evidence is a text/link field for now; later it should support attachment linkage to shipment documents.
- Issue log is shown in overview; final SRS layout may move it into a dedicated Shipment sub-tab.

## 2026-05-24 - SCT-001 Source Change Request

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/source-changes/route.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SCT-001
- BR-SCT-001
- Closing Checklist

What changed:

- Added `ShipmentSourceChangeRequest` model for old source, new source, reason, evidence, impact, status, version, active flag, requester, approver, and approval comment.
- Added `/api/shipments/[id]/source-changes` GET/POST/PATCH route with role checks.
- Traffic/operations users can request a source change from Shipment Monitor.
- Executive users can approve or reject the source change.
- Approving a request marks it active and applies the new source/supplier to the shipment.
- Pending source changes now block shipment closing.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.

Remaining risk:

- Direct source field edits are still technically possible from the existing edit form/API. SCT-002 remains partial until direct overwrite is blocked or routed into a change request.
- Evidence is text/link only for now; later it should support document attachment linkage.

## 2026-05-24 - BCL-001 Barge Change Log

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/app/api/shipments/[id]/barge-changes/route.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-BCL-001
- Closing Checklist

What changed:

- Added `ShipmentBargeChangeLog` model for old/new MV, TB, BG, nomination, reason, evidence, impact, status, version, active flag, requester, approver, and approval comment.
- Added `/api/shipments/[id]/barge-changes` GET/POST/PATCH route with role checks.
- Traffic/operations users can request vessel/barge/nomination changes from Shipment Monitor.
- Executive users can approve or reject the change.
- Approving a request marks it active and applies the new MV/TB/BG/nomination values to the shipment.
- Pending barge changes now block shipment closing.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.

Remaining risk:

- Direct vessel/barge/nomination field edits are still technically possible from the existing edit form/API. A follow-up guard should route those edits through Barge Change Log.

## 2026-05-24 - Traceability Direct Overwrite Guard

Type:

- Code
- Documentation

Changed:

- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- BR-SCT-001
- FR-BCL-001

What changed:

- Shipment update API now blocks direct changes to existing `source` or `supplier` values and requires Source Change Request.
- Shipment update API now blocks direct changes to existing vessel/MV, barge/TB-BG, or nomination values and requires Barge Change Log.
- Initial empty values can still be filled normally; only overwriting an existing traceability value is blocked.
- Shipment Monitor edit form now shows inline hints beside those fields and surfaces backend blocker messages in toast.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.

Remaining risk:

- Evidence for source/barge changes is still text/link only and should later be tied to uploaded shipment documents.

## 2026-05-24 - PAY-001 Shipment Linked Payment Closure

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `src/app/api/memory/outstanding-payment/route.ts`
- `src/store/outstanding-payment-store.ts`
- `src/app/outstanding-payment/page.tsx`
- `src/app/api/memory/shipments/route.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`

SRS refs:

- FR-PAY-001
- Closing Checklist

What changed:

- Outstanding Payment records can link to a shipment with shipment id/name.
- Payment records now store invoice number, due date, dispute status, and notes.
- Shipment closing validation checks unpaid/partial/disputed linked payment records before allowing completed/closed status.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- Existing route checks before this entry returned 200 for `/`, `/shipment-monitor`, `/projects`, and `/outstanding-payment`.

Remaining risk:

- Invoice/full-set/payment-proof document attachment linkage is still pending.

## 2026-05-24 - PAY-002 Payment Evidence Document Linkage

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524094500_payment_document_links/migration.sql`
- `src/types/index.ts`
- `src/app/api/memory/outstanding-payment/route.ts`
- `src/store/outstanding-payment-store.ts`
- `src/app/outstanding-payment/page.tsx`
- `src/app/api/memory/shipments/route.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-PAY-001
- Closing Checklist
- Payment Docs

What changed:

- Added `invoiceDocumentId` and `paymentProofDocumentId` to Outstanding Payment.
- Outstanding Payment form can upload invoice and payment proof files when a shipment is linked.
- Uploaded evidence is stored through the existing shipment document API as additional documents with `PAYMENT_INVOICE` and `PAYMENT_PROOF` requirement codes.
- Outstanding Payment table exposes direct links to the stored evidence documents.
- Shipment closing validation now blocks linked payment records with missing invoice number, missing invoice document, unpaid status, or paid status without payment proof.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed after Prisma Client regeneration completed.
- `GET http://127.0.0.1:3000/outstanding-payment` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/quality` returned 200.

Remaining risk:

- Full-set document bundle and finance approval workflow are still pending.

## 2026-05-24 - QLT-001 QLT-002 Quality Workflow Sections and Comparison

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524093000_quality_workflow_sections/migration.sql`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/quality/route.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/quality/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-QLT-001
- FR-QLT-002
- Closing Checklist

What changed:

- `QualityResult` now stores contract spec, source estimate, QC result, PSI result, COA POL result, COA POD result, comparison status, warning notes, reviewer, and reviewed timestamp.
- Quality API auto-calculates comparison notes/status when contract spec and final result are present and the UI has not forced a manual status.
- Quality page now has structured workflow sections instead of only a flat final result card.
- Shipment closing validation now checks linked quality comparison status and blocks unresolved warning, need review, claim potential, rejected, or pending results.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.

Remaining risk:

- Quality document attachments and dashboard quality-warning aggregation are still pending.

## 2026-05-24 - QLT-003 Quality Evidence Document Linkage

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524100000_quality_document_links/migration.sql`
- `src/types/index.ts`
- `src/store/commercial-store.ts`
- `src/app/api/memory/quality/route.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/quality/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-QLT-001
- FR-QLT-002
- Closing Checklist
- Quality Docs

What changed:

- Added document link fields for QC, PSI, COA POL, and COA POD on `QualityResult`.
- Quality form can upload QC/PSI/COA files when linked to a shipment.
- Uploaded evidence is stored through the existing shipment document API as additional documents with `QUALITY_QC`, `QUALITY_PSI`, `QUALITY_COA_POL`, and `QUALITY_COA_POD` requirement codes.
- Quality cards expose direct links to the uploaded evidence documents.
- Shipment closing validation now blocks passed/approved linked quality records that do not have COA POL or COA POD evidence attached.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed after Prisma Client regeneration completed.
- `GET http://127.0.0.1:3000/quality` returned 200.
- `GET http://127.0.0.1:3000/outstanding-payment` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.

Remaining risk:

- Dashboard quality-warning aggregation is still pending.

## 2026-05-24 - DSH-001 Executive Blocker Control Tower

Type:

- Code
- Documentation

Changed:

- `src/app/api/dashboard/blockers/route.ts`
- `src/app/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DSH-001
- Closing Checklist

What changed:

- Added executive-only dashboard blocker endpoint.
- Blocker API aggregates:
  - payment overdue, unpaid, disputed, missing invoice evidence, and missing payment proof,
  - quality warning/review/claim/rejected and passed quality without COA evidence,
  - pending source change approvals,
  - pending barge change approvals,
  - active shipment closing readiness blockers.
- Dashboard now shows a Blocker Control Tower above Document Aging Alerts for executive roles.
- Panel provides category counts, critical/warning counts, direct links to source modules, and compact owner/due-date metadata.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/` returned 200.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.

Remaining risk:

- Approval-center aggregation is still pending.
- The API is protected by auth/middleware; unauthenticated direct browser checks may return the login HTML shell.

## 2026-05-24 - FS-012 Structured Supplier Candidate Entity

Type:

- Code
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524102000_project_supplier_candidates/migration.sql`
- `src/types/index.ts`
- `src/app/api/projects/[id]/supplier-candidates/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-003
- FR-FS-004
- FR-FS-011

What changed:

- Added `ProjectSupplierCandidate` model for structured Forecast Sales supplier/source candidates.
- Candidate stores project id, source id, supplier/source name, region, fit score, warning text, stock, GAR/TM/TS/Ash, price, status, version, selected winner fields, and audit metadata.
- Added API to list/create/update/select/delete supplier candidates per Forecast Sales.
- Forecast Sales form now saves clicked source candidates as structured rows for existing records while preserving the legacy supplier candidate text field.
- Forecast Sales detail modal shows structured candidates and allows selecting one winner.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed after Prisma Client regeneration completed.
- `GET http://127.0.0.1:3000/projects` returned 200.
- `GET http://127.0.0.1:3000/` returned 200.

Remaining risk:

- Selected winner still needs deeper integration into FCO/source confirmation.

## 2026-05-24 - FS-012 Selected Supplier Rough P&L Feed

Type:

- Code
- Documentation

Changed:

- `src/app/api/projects/[id]/supplier-candidates/route.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-003
- FR-FS-005

What changed:

- Selecting a structured supplier candidate as winner now refreshes Forecast Sales and updates the restricted rough P&L snapshot from the selected candidate price.
- Legacy supplier candidate text and saved blending scenario remain preserved for compatibility.

Verification:

- `npx tsc --noEmit` passed.

Remaining risk:

- Selected supplier still needs formal FCO/source-confirmation linkage and approval/version reporting.

## 2026-05-24 - APR-001 SRS Approval Queue

Type:

- Code
- Documentation

Changed:

- `src/app/api/approval-center/pending/route.ts`
- `src/app/approval-inbox/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-APR-001
- FR-FS-006
- FR-SI-001
- FR-SCT-001
- FR-BCL-001

What changed:

- Added executive/approver approval-center endpoint for pending SRS workflow approvals.
- Aggregates Forecast Sales waiting approval, early SI pending approval, source change requests, and barge change logs.
- Approval Inbox now defaults to SRS Queue with summary cards, item metadata, module deep links, and approve/reject actions that call the existing module endpoints.
- Legacy Tasks, Sales Orders, and Purchase Requests approval tabs remain preserved.

Verification:

- `npx tsc --noEmit` passed.

Remaining risk:

- Resolved later on 2026-05-25 by APR-001 Persistent ApprovalRequest Queue.

## 2026-05-24 - SH-003 MoM/PO Commercial Reference Without Reupload

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524104500_shipment_commercial_reference_docs/migration.sql`
- `src/app/api/memory/shipments/route.ts`
- `src/store/commercial-store.ts`
- `src/types/index.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SH-003
- Commercial Reference
- Document Reuse

What changed:

- Added `commercialMomDocumentId` and `commercialPoDocumentId` to `ShipmentDetail`.
- Shipment Monitor edit modal can select MoM and PO reference documents from linked Forecast Sales `ProjectDocument` records.
- Shipment detail Commercial Reference panel shows selected MoM/PO document links and downloads them through existing ProjectDocument routes.
- No duplicate file upload is created; shipment stores only reference IDs.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/approval-inbox` returned 200.

Remaining risk:

- MoM/PO requirement status is not yet part of a closing blocker or commercial SLA rule.

## 2026-05-24 - SCT-003 Source Confirmation Evidence and Readiness

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524110000_shipment_source_confirmation/migration.sql`
- `src/app/api/memory/shipments/route.ts`
- `src/store/commercial-store.ts`
- `src/types/index.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-SCT-002
- Source Confirmation
- Closing Checklist

What changed:

- Added source confirmation fields to shipment records: confirmation status, evidence document id, notes, confirmer actor/time, legal readiness, and cargo readiness.
- Shipment Monitor edit modal can update source confirmation, legal readiness, cargo readiness, and notes.
- Shipment detail shows Source Confirmation panel with status, legal/cargo readiness, notes, and linked evidence.
- Evidence upload reuses existing ShipmentDocument storage with `SOURCE_CONFIRMATION` requirement code.
- Closing validation blocks explicit non-ready source confirmation/legal/cargo status and confirmed source without evidence.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/shipment-monitor` returned 200.
- `GET http://127.0.0.1:3000/approval-inbox` returned 200.
- `GET http://127.0.0.1:3000/projects` returned 200.

Remaining risk:

- Source master still needs richer supplier-side confirmation request and evidence timeline.

## 2026-05-24 - AUD-001 Real Audit Logs Page

Type:

- Code
- Documentation

Changed:

- `src/app/api/audit-logs/route.ts`
- `src/app/audit-logs/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-AUD-001

What changed:

- Added executive audit logs API reading real `AuditLog` rows.
- Replaced demo audit page with backend-backed table.
- Page supports search across user/action/entity/details.
- Page parses JSON details and shows compact field-change chips when `changes` arrays with old/new values are available.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://127.0.0.1:3000/audit-logs` returned 200.

Remaining risk:

- Some mutation APIs still write raw payloads instead of standardized old/new/reason/evidence detail objects.

## 2026-05-25 - PL-001 Shipment Cost Components Feed

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260524112000_pnl_cost_components/migration.sql`
- `src/app/api/memory/shipments/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `src/app/api/memory/pl-forecasts/route.ts`
- `src/app/pl-forecast/client.tsx`
- `src/lib/sheets-first-service.ts`
- `src/store/commercial-store.ts`
- `src/types/index.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-PL-001
- Commercial & Finance
- Shipment Monitor completeness/P&L feed

What changed:

- Added shipment-level per-MT cost components for royalty, export tax/levy, survey, and payment/finance, alongside existing buying and freight cost fields.
- Shipment Monitor edit modal can input the new cost components.
- Shipment detail commercial card now shows freight, royalty/tax, survey/payment cost context and estimates GP using full unit cost.
- P&L Forecast derives weighted cost components per Forecast Sales/MV from shipment rows.
- P&L Forecast create/update form, optimistic store, API calculation, DB cache service, and list/sync mapping now include royalty, tax, survey, payment, freight, buying, and other cost components.
- Google Sheets compatibility is preserved: existing A:J rows remain usable, and optional detailed-cost headers can be parsed when present.

Verification:

- `npx prisma generate` passed after restarting the local Next dev server that was locking Prisma engine files.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/pl-forecast` returned 200.
- `GET http://localhost:3000/shipment-monitor` returned 200.
- `GET http://localhost:3000/projects` returned 200.

Remaining risk:

- Remote Supabase migration apply could not be verified from this machine because the database host was unreachable (`P1001`). The migration is additive/idempotent and should be applied when DB connectivity is available.
- P&L still needs full estimated-vs-actual reconciliation and stronger executive-only presentation rules.

## 2026-05-25 - DOM-001 Domestic Handover Tracking

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260525093000_domestic_handover_tracking/migration.sql`
- `src/app/api/memory/daily-delivery/route.ts`
- `src/store/daily-delivery-store.ts`
- `src/types/index.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-007
- Domestic Document Handover
- SRS `04_Document_Management.md` section 7

What changed:

- Added additive Daily Delivery fields for SKAB-SK flow: supplier sent, operation received/sent, traffic received/sent finance, finance received, evidence ref, notes.
- Added DSR Carbon flow dates from supplier to operation to traffic.
- Added BL/CM flow dates from operation to traffic to finance.
- Added COA POL flow dates from surveyor to traffic to finance.
- Added COA POD/final docs dates for COA POD received, finance full-set submission, vendor receipt, approval DT, paid to vendor.
- Added full-set, hardcopy, and softcopy statuses.
- Shipment Monitor Daily Delivery table now shows document completion count, active stuck party, and aging days.
- Daily Delivery modal now has a Domestic Handover tab with grouped fields for the handover flows.
- Daily Delivery store now maps snake_case UI fields to camelCase API fields, fixing legacy create/update field mapping at the same time.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed after `.next/types` regenerated from the restarted dev server.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Evidence is currently stored as reference/id text fields; direct drag/drop evidence linkage to document storage should be added next.
- Dashboard still needs a domestic handover stuck-by-party widget.
- Remote Supabase migration apply remains unverified because DB connectivity was previously blocked.

## 2026-05-25 - DSH-001 Domestic Handover Dashboard Alerts

Type:

- Code
- Documentation

Changed:

- `src/app/api/dashboard/blockers/route.ts`
- `src/app/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DSH-001
- Domestic Document Handover dashboard requirement

What changed:

- Executive Blocker Control Tower now includes a `Domestic` category.
- Dashboard blocker API reads `DailyDelivery` domestic handover fields and generates alerts for SKAB, DSR, BL/CM, COA POL, and COA POD/final docs that are incomplete or stuck.
- Alert messages show the active stuck party and aging days.
- Summary counts now include domestic handover blockers.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Domestic handover evidence references are not yet direct file uploads.
- Dashboard drill-down still links to Shipment Monitor broadly instead of opening the exact Daily Delivery row.

## 2026-05-25 - DOM-001 Domestic Handover Evidence Upload

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260525103000_daily_delivery_documents/migration.sql`
- `src/app/api/daily-delivery/[id]/documents/route.ts`
- `src/app/api/daily-delivery/[id]/documents/[docId]/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `src/types/index.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-007
- UP-001
- UP-002
- Domestic Document Handover

What changed:

- Added `DailyDeliveryDocument` DB-backed document storage for domestic handover evidence.
- Added API to list/upload/download/delete Daily Delivery documents.
- Evidence upload accepts images, PDF, and DOCX, with 10MB max size.
- Domestic Handover tab now has drag/drop and choose-file evidence upload for SKAB-SK, DSR Carbon, BL/CM, COA POL, and COA POD/final docs.
- Uploaded evidence auto-links back to the corresponding Daily Delivery evidence reference field.
- Evidence files can be opened/downloaded and deleted from the same handover tab.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor` returned 200.

Remaining risk:

- Remote Supabase migration apply remains unverified because DB connectivity was previously blocked.

## 2026-05-25 - DSH-001 Domestic Dashboard Exact Drill-Down

Type:

- Code
- Documentation

Changed:

- `src/app/api/dashboard/blockers/route.ts`
- `src/app/shipment-monitor/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DSH-001
- Domestic Document Handover

What changed:

- Domestic blocker alerts now generate `/shipment-monitor?main=daily&daily=<id>&dailyTab=handover` links.
- Shipment Monitor reads the deep-link, switches to Daily Delivery, opens the exact row, and selects the Domestic Handover tab.
- The targeted Daily Delivery row is highlighted and the table row itself can be clicked to edit the record.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor?main=daily` returned 200.
- `GET http://localhost:3000/pl-forecast` returned 200.

Remaining risk:

- Non-domestic dashboard categories can still get richer exact-section drill-down later.

## 2026-05-25 - APR-001 Persistent ApprovalRequest Queue

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260525113000_approval_request/migration.sql`
- `src/app/api/approval-center/pending/route.ts`
- `src/app/approval-inbox/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-APR-001

What changed:

- Added additive `ApprovalRequest` model/table for a persistent cross-module approval queue.
- `/api/approval-center/pending` now mirrors pending Forecast Sales, early SI, source change, and barge change workflow items into `ApprovalRequest`.
- Queue rows store kind, record ID, shipment ID, title, status, priority, href, metadata, source update time, SLA due date, and resolution fields.
- Approval Inbox now shows SLA due time, open age, overdue count, kind filter, priority/SLA filter, and still calls existing workflow-specific approval endpoints.
- Successful approve/reject actions also mark the `ApprovalRequest` row resolved with decision comment.

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor?main=daily` returned 200.
- `GET http://localhost:3000/approval-inbox` returned 200.
- `GET http://localhost:3000/pl-forecast` returned 200.

Remaining risk:

- Remote Supabase migration apply remains unverified because DB connectivity was previously blocked.
- Broader approval types and dedicated approval history detail page can be added later.

## 2026-05-25 - AUD-002 Critical Mutation Audit Payload Standardization

Type:

- Code
- Documentation

Changed:

- `src/app/api/memory/projects/route.ts`
- `src/app/api/shipments/[id]/shipping-instructions/route.ts`
- `src/app/api/shipments/[id]/source-changes/route.ts`
- `src/app/api/shipments/[id]/barge-changes/route.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-AUD-001
- Critical revision/change traceability

What changed:

- Standardized high-risk audit `details` payloads to include `schemaVersion`, `actionType`, `reason`, `evidence`, `changes`, and `context`.
- Forecast Sales update/approval audit now records structured field changes and reason/evidence context.
- Shipping Instruction create/revision/approval/rejection/cancellation audit now records status/version/SI number changes and reason/evidence context.
- Source Change Request audit now records old/new source, request/decision reason, evidence, version, and approval context.
- Barge Change Log audit now records old/new MV/barge/nomination, request/decision reason, evidence, version, and approval context.

Verification:

- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/approval-inbox` returned 200.
- `GET http://localhost:3000/shipment-monitor?main=daily` returned 200.
- `GET http://localhost:3000/audit-logs` returned 200.

Remaining risk:

- Lower-risk mutation APIs should adopt the same schema gradually.

## 2026-05-25 - DOC-007 Optional Production Object Storage

Type:

- Code
- Database
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260525123000_document_object_storage/migration.sql`
- `src/lib/document-storage.ts`
- `src/app/api/projects/[id]/documents/route.ts`
- `src/app/api/projects/[id]/documents/[docId]/route.ts`
- `src/app/api/shipments/[id]/documents/route.ts`
- `src/app/api/shipments/[id]/documents/[docId]/route.ts`
- `src/app/api/shipments/[id]/documents/download-all/route.ts`
- `src/app/api/shipments/documents/batch/route.ts`
- `src/app/api/daily-delivery/[id]/documents/route.ts`
- `src/app/api/daily-delivery/[id]/documents/[docId]/route.ts`
- `src/types/index.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-001
- UP-001
- UP-002
- Production document storage requirement

What changed:

- Added optional storage metadata columns to `ProjectDocument`, `ShipmentDocument`, and `DailyDeliveryDocument`: `storageProvider`, `storageKey`, `storageUrl`.
- Added `src/lib/document-storage.ts`, which stores file bytes in Supabase Storage when configured and falls back to DB bytes when not configured.
- Shipment document upload/download, Project document upload/download, Daily Delivery evidence upload/download, and Shipment ZIP download now read from the proper storage backend.
- Existing DB-backed file behavior remains the default, so local testing and old files remain compatible.

Production env required for object storage:

- `DOCUMENT_STORAGE_PROVIDER=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

Verification:

- `npx prisma generate` passed.
- `npx tsc --noEmit` passed.
- `GET http://localhost:3000/` returned 200.
- `GET http://localhost:3000/shipment-monitor?main=daily` returned 200.
- `GET http://localhost:3000/projects` returned 200.
- `GET http://localhost:3000/approval-inbox` returned 200.

Remaining risk:

- Remote Supabase migration apply and bucket/env setup remain unverified from this machine.

## 2026-05-25 - DOC-008 Document Drive and FS-018 Dashboard Drill-Down

Type:

- Code
- UI
- Documentation

Changed:

- `src/app/document-drive/page.tsx`
- `src/app/api/document-drive/route.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/constants.ts`
- `src/types/index.ts`
- `src/app/projects/page.tsx`
- `src/store/commercial-store.ts`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-001
- Document public access / drive-only role requirement
- FR-FS-010

What changed:

- Added `/document-drive` as a read-only document aggregator for Forecast Sales, Shipment, and Domestic Handover documents.
- Added source/group/search filters, summary counters, and direct open/download actions.
- Added `document_drive` permission and sidebar/header route support; `staff` role can access only Document Drive.
- AppShell now blocks document-only users from other routes and avoids starting broad module auto-sync/chatbot for that role.
- Critical shipment documents remain hidden from non-executive users in the Document Drive API.
- Forecast Sales dashboard KPI cards now expand into drill-down lists showing project name, buyer, offer by, and current status/feedback; clicking a row opens the Forecast Sales detail.
- Commercial store persistence now catches localStorage quota overflow and repopulates from database sync instead of throwing a UI console error.

Verification:

- `npx tsc --noEmit` passed.
- `/document-drive` loaded in Playwright, API returned documents, and no console errors remained after the migration-partial table guard.
- `/projects` loaded in Playwright, Forecast Sales dashboard dropdown opened, and no console errors remained after the localStorage quota guard.

Remaining risk:

- Production role provisioning needs to assign `STAFF` or equivalent document-only users consistently.
- Document Drive is an aggregator/read-only browser, not yet a full folder/file-manager UI with uploads from the drive itself.

## 2026-05-25 - FS-001 Canonical Forecast Sales Route and DOC-009 Drive File Proxy

Type:

- Code
- Security/Access Control
- Documentation

Changed:

- `src/app/forecast-sales/page.tsx`
- `src/middleware.ts`
- `src/lib/constants.ts`
- `src/components/layout/header.tsx`
- `src/app/page.tsx`
- `src/app/sales-monitor/page.tsx`
- `src/app/shipment-monitor/page.tsx`
- `src/app/api/approval-center/pending/route.ts`
- `src/app/api/document-drive/route.ts`
- `src/app/api/document-drive/files/[sourceType]/[ownerId]/[docId]/route.ts`
- `src/app/layout.tsx`
- `public/favicon.svg`

SRS refs:

- FR-FS-001
- Document public access / drive-only role requirement
- SEC route access hardening

What changed:

- Added canonical `/forecast-sales` route while keeping legacy Forecast Sales implementation under `/projects/page.tsx` for compatibility.
- Middleware redirects `/projects` to `/forecast-sales` and redirects non-executive dashboard access to `/forecast-sales`.
- Staff/document-only users are blocked server-side from non-Document Drive pages and non-Document Drive APIs.
- Document Drive file URLs now use `/api/document-drive/files/...` so visible documents can be downloaded through the Drive module without granting source-module access.
- Critical shipment documents remain blocked in the Drive file proxy for non-executive users.
- Added a small SVG favicon and metadata reference to remove favicon 404 noise during QA.

Verification:

- `npx tsc --noEmit` passed before documentation update.
- `git diff --check` passed with only existing Windows CRLF warnings.
- `/forecast-sales` loaded in Playwright.
- `/projects?q=tes` redirected to `/forecast-sales?q=tes` in Playwright.

Remaining risk:

- Production should confirm actual staff users are assigned role `STAFF` or a mapped document-only role.

## 2026-05-25 - FS-005/FS-007 FCO and Buyer Feedback History

Type:

- Code
- Database
- UI
- Documentation

Changed:

- `prisma/schema.prisma`
- `prisma/migrations/20260525160000_project_fco_feedback_history/migration.sql`
- `src/types/index.ts`
- `src/app/api/memory/projects/route.ts`
- `src/store/commercial-store.ts`
- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-007
- FR-FS-008
- Audit/history requirement for generated FCO and buyer feedback

What changed:

- Added additive `ProjectItem.fcoHistory` and `ProjectItem.buyerFeedbackHistory` fields.
- API migration guard and Prisma migration add both fields without changing existing Forecast Sales data.
- FCO generation/download now appends history with version/action/FCO number/user/time.
- Buyer feedback changes now append history with previous status/status/reason/FCO number/user/time.
- Forecast Sales detail modal now shows FCO Control history and Buyer Feedback history.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed with only existing Windows CRLF warnings.

Note:

- `npx prisma generate` was attempted but Windows blocked replacing the Prisma engine DLL because it was in use by the running dev server. TypeScript still passed; rerun `npx prisma generate` after stopping the dev server before production build/deploy.

## 2026-05-25 - FS-012 Selected Supplier Handoff

Type:

- Code
- UI/PDF
- Documentation

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-003
- FR-FS-007
- Forecast Sales Deal -> Shipment handoff
- Source confirmation readiness

What changed:

- Selected structured supplier candidate is now preferred over free-text supplier candidate during Forecast Sales handoff.
- FCO clause M now includes the selected supplier/source reference with fit score, price, region, and quality snapshot when available.
- Deal -> Shipment conversion now carries selected supplier into `supplier` and `source`.
- Deal -> Shipment conversion now adds `source_confirmation_status=pending` and structured source confirmation notes when a selected supplier exists.

Verification:

- `npx tsc --noEmit` passed.

## 2026-05-25 - SYS-001 Production Readiness Checker

Type:

- Code
- UI
- Documentation
- Verification

Changed:

- `src/app/api/system/production-readiness/route.ts`
- `src/app/production-readiness/page.tsx`
- `src/lib/constants.ts`
- `src/components/layout/header.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- Production readiness
- Release control
- Document storage production requirement
- Remote migration verification

What changed:

- Added executive-only `/api/system/production-readiness` endpoint.
- Added `/production-readiness` UI under System navigation for executive/audit roles.
- Checker validates `DATABASE_URL`, `NEXTAUTH_SECRET`, optional `NEXTAUTH_URL`, storage provider/env vars, DB connectivity, expected Prisma migration history, and critical SRS migration tables/columns across Forecast Sales, document storage, Shipment Monitor, SI, source/barge change logs, domestic handover, quality, payment, P&L, approval, and audit.
- UI shows overall readiness, pass/warn/fail counters, generated time, and detailed check rows.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed with only existing Windows CRLF warnings.
- `npx tsc --noEmit` passed again after broadening the production schema checks.
- `npx tsc --noEmit` passed again after adding expected Prisma migration history verification.

Remaining risk:

- This checker surfaces release blockers; it does not apply remote migrations or configure Vercel/Supabase env automatically.
- Run it against the actual Vercel/Supabase production environment after deploy.

## 2026-05-25 - FS-019 Summary Report Parity Hardening

Type:

- Code
- Documentation
- Verification

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- Summary Report
- Forecast Sales reporting output

What changed:

- Summary Report keeps the one-page subject/detail structure from the Borneo Pasifik Global sample.
- Report now falls back to Forecast Sales master specs for GAR/TM/TS/Ash/VM/Size when shipment actual specs are not available.
- Report now uses saved blending scenario result as a stronger fallback for blended GAR/TM/TS/Ash.
- Budget vs Actual values can use restricted rough P&L snapshot when shipment cost rows are still incomplete.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check -- src/app/projects/page.tsx` passed with only existing Windows CRLF warning.

Remaining risk:

- Final visual sign-off still needs business acceptance against a real signed/company template, especially if exact logo artwork is required.

## 2026-05-25 - FS-020 Forecast Sales Market Price Reference

Type:

- Code
- UI
- Documentation
- Verification

Changed:

- `src/app/projects/page.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-FS-002
- Market Price reference
- Historical selling price reference

What changed:

- Forecast Sales form now reads latest Market Price data directly from the commercial store.
- Reference price is selected by price basis: Newcastle, HBA, or ICI band based on target GAR.
- Form shows historical selling average from prior shipment rows that match buyer/commodity where available.
- Form shows target-vs-reference gap and warns when target selling price is below the reference threshold.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check -- src/app/projects/page.tsx` passed with only existing Windows CRLF warning.

Remaining risk:

- Warning threshold currently uses a practical 2% tolerance and should be tuned after real trading acceptance.

## 2026-05-25 - PL-001 Estimated vs Actual P&L Reconciliation

Type:

- Code
- UI
- Documentation
- Verification

Changed:

- `src/app/pl-forecast/client.tsx`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-PL-001
- Restricted rough P&L
- Forecast Sales to P&L reconciliation

What changed:

- P&L Forecast now reads Forecast Sales `rough_pnl` as the estimate baseline.
- Forecast Sales rollup now shows actual GP, estimated GP, variance amount, and variance percent.
- Forecast rows show estimated GP variance per Forecast Sales/MV context.
- Summary cards now include total estimated-vs-actual GP variance for executive review.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check -- src/app/pl-forecast/client.tsx` passed with only existing Windows CRLF warning.

Remaining risk:

- Production readiness must pass on Vercel/Supabase after deployment to prove remote migrations and env are applied.

## 2026-05-25 - Supabase Query Storm Mitigation

Type:

- Code
- Performance
- Production Stability

Changed:

- `src/store/commercial-store.ts`
- `src/components/global-market-scraper.tsx`
- `src/app/api/memory/shipments/route.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/api/memory/sources/route.ts`
- `src/app/api/memory/quality/route.ts`
- `src/app/api/memory/market-prices/route.ts`
- `src/app/api/memory/pl-forecasts/route.ts`

What changed:

- Normal commercial boot sync now requests shipment data with `lite=1` to reduce rows/columns processed by Supabase.
- Global market scraper no longer triggers an extra full commercial sync on app boot.
- Runtime schema guard calls are cached per server instance for shipment, project, source, quality, and market price APIs to reduce repeated `ALTER TABLE IF NOT EXISTS` pressure.
- `GET /api/memory/pl-forecasts` no longer performs auto-heal writes or mass `updateMany` restore during normal reads; Sheet sync remains explicit through `?sync=1`.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed with only existing Windows CRLF warnings.

Reason:

- Supabase Query Performance showed query storm symptoms: thousands of shipment reads, repeated runtime schema operations, and thousands of P&L forecast updates. Read endpoints must stay read-only in production.

## 2026-05-25 - Public Document Drive, SI Listing, and Forecast Dashboard Layout

Type:

- Code
- UI
- Performance
- Documentation

Changed:

- `src/app/projects/page.tsx`
- `src/app/document-drive/page.tsx`
- `src/app/api/document-drive/route.ts`
- `src/app/api/document-drive/files/[sourceType]/[ownerId]/[docId]/route.ts`
- `src/app/api/system/production-readiness/route.ts`
- `src/middleware.ts`
- `SRS_CoalTrade_OS_Revisi/04_Document_Management.md`
- `SRS_CoalTrade_OS_Revisi/08_Forecast_Sales_FCO_Revision.md`
- `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`
- `Revisi_Execution/03_Execution_Backlog.md`
- `Revisi_Execution/04_Module_Implementation_Status.md`
- `Revisi_Execution/07_No_Overwrite_Checklist.md`

SRS refs:

- FR-DOC-DRIVE-001 to FR-DOC-DRIVE-004
- UI-FS-001
- FR-SI-001

What changed:

- Forecast Sales summary cards now use wider responsive columns and `items-start`, so opening one dropdown does not visually stretch every card.
- Document Drive route and API are public read-only; logged-out users can access Document Drive while other modules remain protected.
- Document Drive now includes generated Shipping Instruction records as downloadable PDFs through the Drive proxy.
- Document Drive titles now combine owner/project/shipment, document type, buyer, SI number/version where available, making search results clearer than generic labels.
- Document Drive listing no longer runs schema `ALTER TABLE` guards on every request and uses bounded metadata-only selects for faster load.
- Production readiness schema checks now run in parallel to reduce long loading time.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed for changed files with only existing Windows CRLF warnings.

Remaining risk:

- Public Drive intentionally excludes critical documents for logged-out users; critical access still requires executive login.

## 2026-05-25 - Forecast Sales Production Load Guard

Type:

- Code
- Performance
- UI

Changed:

- `src/app/api/memory/projects/route.ts`
- `src/app/projects/page.tsx`

SRS refs:

- UI-FS-001
- Production readiness / Vercel load stability

What changed:

- Forecast Sales API no longer runs every `ALTER TABLE IF NOT EXISTS` guard on every GET; it checks existing columns first, adds only missing columns, and caches the check per server instance.
- Forecast Sales page shows a syncing state instead of rendering zero dashboard values while production data is still loading.
- Forecast Sales API responses explicitly return `Cache-Control: no-store` so dashboard data is not served from a stale route cache.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed with only existing Windows CRLF warnings.

Remaining risk:

- If Vercel/Supabase production database itself has no Forecast Sales rows, the dashboard will correctly show zero after sync; this patch prevents false-zero while the API is still loading or delayed.

## 2026-05-25 - Forecast Sales Progressive Sync and Skeleton Restore

Type:

- Code
- Performance
- UI

Changed:

- `src/store/commercial-store.ts`
- `src/app/projects/page.tsx`

SRS refs:

- UI-FS-001
- Production readiness / perceived load performance

What changed:

- `syncFromMemory()` now applies each non-shipment endpoint as soon as that endpoint returns, instead of waiting for all remaining commercial endpoints before updating Forecast Sales/project state.
- Initial Forecast Sales load no longer forces a full network refresh when cached/persisted commercial data can render immediately.
- Forecast Sales card skeletons are restored for true cold loads so users see a proper loading surface instead of empty/zero data.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed with only existing Windows CRLF warnings.

Root cause note:

- The slow-feeling behavior was not the KPI dropdown layout itself. The heavier issue was the store sync barrier: a slow endpoint in the commercial sync batch could delay project/forecast data being applied, and the page had no proper client-side skeleton for that data phase.

## 2026-05-25 - FCO Download Immediate Response

Type:

- Code
- UX

Changed:

- `src/app/projects/page.tsx`

SRS refs:

- FS-005 / FCO generation and download

What changed:

- FCO PDF download now starts immediately after client-side PDF generation instead of waiting for the database history update and commercial sync first.
- FCO button now shows a `Preparing...` state and disables duplicate clicks while the file is being prepared.
- FCO number/generated-at is reflected optimistically in the open Forecast Sales modal; backend history update still runs after the download trigger.

Verification:

- `npx tsc --noEmit` passed.
- `git diff --check` passed with only existing Windows CRLF warnings.
