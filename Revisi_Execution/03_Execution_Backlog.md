# Execution Backlog

Status values:

- `Not Started`
- `In Progress`
- `Blocked`
- `Partial`
- `Done`
- `Deferred`

Priority values:

- `P0`: must do first, core SRS blocker.
- `P1`: high priority production-grade workflow.
- `P2`: important but can follow core flow.
- `P3`: hardening/automation.

## Phase 0 - Documentation Control

| ID | Task | Status | Evidence / Notes |
|---|---|---|---|
| EX-000 | Create Revisi Execution folder and protocol | Done | `Revisi_Execution/*` created 2026-05-23 |
| EX-001 | Keep SRS and Execution docs linked | Done | `SRS_CoalTrade_OS_Revisi/00_README.md` should mention execution companion |
| EX-002 | Maintain current code vs SRS gap snapshot | Done | `02_Current_Code_vs_SRS_Gap.md` |

## Phase 1 - Forecast Sales and FCO Foundation

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| FS-001 | P0 | FR-FS-001 | Rename product-facing Projects to Forecast Sales | Done/Strong | Sidebar/header/page labels/actions say Forecast Sales; canonical `/forecast-sales` route exists; legacy `/projects` redirects for compatibility; `ProjectItem` remains internal compatibility model |
| FS-002 | P0 | FR-FS-002 | Add Forecast Sales draft/offer profile fields | Done | Draft supports buyer, country, commodity, qty, laycan, POL, sales term, target price, basis, payment, surveyor, spec |
| FS-003 | P0 | FR-FS-002 | Mandatory validation before Submit Offer Profile | Done | Incomplete draft can save; submit blocks missing mandatory fields with clear list |
| FS-004 | P0 | FR-FS-006 | CEO approval workflow for offer profile | Done | Submitted/Review/Approved/Revision/Rejected with comments and history |
| FS-005 | P0 | FR-FS-007 | FCO number and PDF generator | Done/Strong | Unique number; PDF follows `FCO.C2604 (1).pdf` clause structure; generated from approved offer; generation/download history is stored |
| FS-006 | P0 | FR-FS-007 | Block FCO download before approval | Done | Unapproved record cannot download/generate FCO |
| FS-007 | P1 | FR-FS-008 | Buyer feedback and Deal/Failed flow | Done/Strong | FCO Sent, Waiting Feedback, Negotiation, Deal, Failed; failed reason required; feedback history is stored |
| FS-008 | P1 | FR-FS-008 | Failed offer CEO notification | Done | Failed Forecast Sales offers surface in management header notifications |
| FS-009 | P0 | FR-FS-009 | Convert Forecast Sales Deal to Shipment | Done | Deal creates/updates linked Shipment and carries buyer, commodity, qty, laycan, POL, price, payment, surveyor, supplier, PIC/FCO reference |
| FS-010 | P1 | FR-FS-010 | Forecast Sales dashboard cards | Done | Total forecast, draft, review, approved, FCO sent, pending feedback, deal, failed, revenue/margin restricted |
| FS-011 | P1 | FR-FS-011 | Price/laycan/supplier revision log | Done | Old/new value, reason, user, timestamp, approval reference if applicable |
| FS-018 | P1 | FR-FS-010 | Forecast Sales dashboard drill-down dropdown | Done | Each KPI bucket can expand to show related Forecast Sales records with project name, buyer, offer by, and status; clicking a row opens the project detail |
| FS-019 | P1 | Summary Report | Forecast Sales Summary Report parity | Done/Strong | Summary PDF follows the sample subject/detail sections and falls back to master offer specs, saved blending scenario, and rough P&L when shipment rows are incomplete |
| FS-020 | P1 | FR-FS-002 / Market Price | Forecast Sales market price reference warning | Done/Strong | Forecast Sales form shows latest market reference by basis/GAR band, historical selling average, target gap, and warning when target price is below reference |

## Phase 2 - Supplier Candidate, Blending, and Rough P&L

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| FS-012 | P1 | FR-FS-003 | Supplier candidate selection from Source | Done/Strong | Multiple candidates can be added from Source records, persisted as structured rows, selected as winner, selected price feeds rough P&L, selected supplier appears in FCO, and selected supplier/source notes carry into Shipment conversion |
| FS-013 | P1 | FR-FS-003 | Quality fit score and below-spec warning | Done | Source candidate picker shows fit score and initial warning |
| FS-014 | P1 | FR-FS-003 | Below-spec acknowledgment reason | Done | Cannot submit below-spec selection without reason |
| FS-015 | P1 | FR-FS-004 | Embedded blending simulation in Forecast Sales | Done | Candidate mix returns final GAR/TM/TS/Ash and cost |
| FS-016 | P1 | FR-FS-004 | Save blending scenario to offer | Done | Scenario output stored as offer reference |
| FS-017 | P1 | FR-FS-005 | Restricted rough P&L auto generation | Done | Auto revenue/cost/margin snapshot is generated on create/update and shown only to executive approval roles |

## Phase 3 - Shipment Monitor Foundation

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| SH-001 | P0 | FR-SH-001 | Restructure Shipment detail into SRS sub-tabs | Partial | Existing modal has tabs, but not full SRS sections |
| SH-002 | P0 | FR-SH-005 | Shipment Data Completeness score | Done | Percentage, missing field list, placeholder detection |
| SH-003 | P1 | FR-SH-003 | Commercial Reference linked to Forecast Sales/FCO | Partial/Strong | Shipment shows linked Forecast Sales/FCO and can reference MoM/PO ProjectDocument files without reupload |
| SH-004 | P1 | FR-SH-004 | Issue Log structured records | Done | Issue category, impact, action, PIC, target date, status, evidence, status update, and closing blocker integration |
| SH-005 | P0 | Closing Checklist | Closing validation | Partial | Required documents, valid active SI, payment/commercial gaps, quality readiness, structured issue log, pending source/barge change, and unresolved issue signals block shipment closing |

## Phase 4 - Document Management

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| DOC-001 | P0 | FR-DOC-001 | Preserve current shipment document upload/download | Done/Strong | Existing upload/download/zip must not be removed; upload/download now supports optional Supabase object storage with DB fallback |
| DOC-002 | P0 | FR-DOC-001 | Add Document Checklist item model | Done | Checklist item separate from file attachment; required checklist seeds per shipment and updates independently from uploads |
| DOC-003 | P0 | FR-DOC-001 | Add received/submitted dates and aging | Done | Expected/received/submitted dates editable; aging chip visible on required checklist items |
| DOC-004 | P1 | FR-DOC-001 | Add owner/responsible party/hardcopy status | Done | Owner, PIC/responsible party, and hardcopy status editable per required checklist item |
| DOC-005 | P1 | FR-DOC-001 | Dashboard document aging alert | Done | Overdue/rejected/aging required shipment docs show in executive dashboard |
| DOC-006 | P1 | UP-004 | Critical document replacement history | Done | Same-title critical upload creates version/history, marks prior critical document superseded, and keeps old file downloadable |
| DOC-007 | P1 | Production document storage | Optional Supabase object storage | Done/Strong | Project, Shipment, and Daily Delivery document APIs can store files in Supabase Storage with DB fallback |
| DOC-008 | P1 | Document public access | Document Drive aggregator | Done/Strong | `/document-drive` is public read-only and aggregates Forecast Sales, Shipment, generated SI, and Domestic Handover documents with search/source/group filters and clear owner-based names; logged-out users can access only this module |
| DOC-009 | P1 | Document public access | Drive-owned download proxy | Done/Strong | Document Drive file links use `/api/document-drive/files/...`, allowing public/document-only users to download visible non-critical files and generated SI PDFs without accessing source module routes |
| DOC-010 | P1 | Document performance | Document Drive listing performance | Done | Listing uses metadata-only selects, bounded limits, and no schema mutation in the request path; file bytes/PDF are loaded only on open/download |

## Phase 5 - Traceability

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| SCT-001 | P0 | FR-SCT-001 | Source Change Request model/API/UI | Done | Old/new source, reason, evidence, impact, approval/rejection, active version, and closing blocker |
| SCT-002 | P0 | BR-SCT-001 | Source activation rule | Done | Approved source change applies new shipment source/supplier and direct source/supplier overwrite is blocked outside request flow |
| SCT-003 | P1 | FR-SCT-002 | Source confirmation readiness/evidence | Done/Strong | Shipment stores source confirmation status, legal readiness, cargo readiness, notes, confirmation actor/time, and evidence document link; confirmed source without evidence blocks closing |
| BCL-001 | P0 | FR-BCL-001 | Barge Change Log model/API/UI | Done | Old/new MV/TB/BG/nomination, reason, evidence, impact, approval/rejection, active version, and closing blocker |
| SI-001 | P0 | FR-SI-001 | Shipping Instruction entity/version | Done | SI has number/version/status per shipment and a version-linked PDF download generated from record snapshot |
| SI-002 | P0 | BR-SI-001 | H-10 rule and early approval | Done | Early SI requires reason and approval |
| SI-003 | P1 | FR-SI-002 | SI revision/cancellation workflow | Done | Old SI remains, version increments, cancellation reason/history retained |

## Phase 6 - Quality, Payment, P&L, Dashboard

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| QLT-001 | P1 | FR-QLT-001 | Quality workflow sections | Done/Strong | Contract, source estimate, QC, PSI, COA POL, COA POD are stored and editable per quality result |
| QLT-002 | P1 | FR-QLT-002 | Quality comparison and warning | Partial/Strong | Passed/Warning/Need Review/Claim Potential/Rejected exists, quality evidence docs can link to shipment documents, and linked warnings/missing COA evidence block shipment closing; still needs dashboard aggregation |
| PAY-001 | P1 | FR-PAY-001 | Payment linked to shipment | Done/Strong | Outstanding Payment can link to shipment, store invoice/payment proof documents as shipment documents, and closing checks unpaid or missing-evidence linked records |
| FRT-001 | P2 | FR-FRT-001 | Freight structured cost and docs | Partial | Existing transshipment page needs SRS integration |
| PL-001 | P1 | FR-PL-001 | Estimated vs actual P&L integration | Done/Strong | P&L forecast auto-feeds shipment buying, freight, royalty, export tax/levy, survey, payment/finance, and other costs, then reconciles actual/rollup GP against Forecast Sales rough P&L estimate |
| DOM-001 | P1 | FR-DOC-007 | Domestic handover SKAB/DSR/BL/COA flow | Done/Strong | Daily Delivery tracks SKAB, DSR, BL/CM, COA POL, COA POD/final docs, full set, hardcopy, softcopy, stuck party, aging, executive dashboard alerts, and direct drag/drop evidence upload |
| DSH-001 | P1 | FR-DSH-001 | Dashboard blocker control tower | Done/Strong | Executive dashboard shows payment, quality, source, barge, domestic handover, and closing blockers; domestic handover blockers deep-link to the exact Daily Delivery row and handover tab |
| APR-001 | P0 | FR-APR-001 | Generic Approval Center | Done/Strong | Approval Inbox now persists SRS Queue rows in `ApprovalRequest` for Forecast Sales approval, early SI approval, source change, and barge change, with SLA due time, open age, overdue count, kind/priority filters, and approve/reject actions |
| AUD-001 | P0 | FR-AUD-001 | Real audit log page and field diff | Partial/Strong | Audit page reads real backend logs, supports search, parses available change/detail JSON into field chips, and high-risk Forecast Sales/SI/source/barge mutations now write standardized old/new/reason/evidence payloads; lower-risk APIs can be standardized gradually |

## Phase 7 - Production Readiness and Release Control

| ID | Priority | SRS Ref | Task | Status | Definition of Done |
|---|---|---|---|---|---|
| SYS-001 | P1 | Production readiness | Executive production readiness checker | Done/Strong | `/api/system/production-readiness` and `/production-readiness` check required env vars, optional `NEXTAUTH_URL`, Supabase Storage env, DB connectivity, expected Prisma migrations, and critical production tables/columns across SRS modules |
| PERF-001 | P0 | FR-PERF-001..009 | Navigation warm-cache and sync storm mitigation | Done/Strong | AppShell route changes no longer trigger immediate global sync, dashboard no longer force-syncs on mount, stores skip fresh warm-cache sync for 60s, full commercial sync has separate freshness from dashboard fast sync, and manual sync can still force refresh |

## Active Next Recommended Task

Recommended next implementation task:

Production readiness release gate.

Reason:

- FS-001 through FS-017 are done.
- FCO generation, approval gate, buyer feedback, failed notification, Deal -> Shipment conversion, dashboard cards, Source candidate selection, fit score/warning, below-spec acknowledgement, embedded blending simulation, saved blending scenario, critical revision logging, and restricted rough P&L are in place.
- Payment linkage, invoice/payment-proof evidence attachment, quality/COA evidence attachment, executive blocker dashboard, and structured supplier candidate persistence are now implemented.
- Selected supplier winner now feeds rough P&L, and Approval Inbox has an SRS Queue for Forecast Sales/SI/source/barge decisions.
- Shipment Monitor and P&L Forecast now have richer freight/royalty/tax/survey/payment cost feeds in code, with Prisma client generated locally.
- Domestic handover tracking now exists in Daily Delivery for SKAB/DSR/BL/COA/final docs with stuck-party aging, executive dashboard alerts, exact row/handover-tab deep links, and direct evidence upload.
- Approval Inbox now has persisted `ApprovalRequest` queue rows with SLA/filtering while preserving existing workflow-specific approval endpoints.
- High-risk Forecast Sales/SI/source/barge mutation audits now use a standardized old/new/reason/evidence payload schema.
- Project, Shipment, and Daily Delivery document routes now support optional Supabase object storage with DB fallback.
- Document Drive now exists as a public read-only document module with a dedicated navbar/permission path.
- Forecast Sales dashboard cards now have drill-down dropdowns per estimate/status bucket.
- P&L now includes estimated-vs-actual reconciliation from Forecast Sales rough P&L to actual shipment/P&L rollup.
- Local SRS implementation is complete.
- Production Readiness checker is the remaining release gate for the deployed Vercel/Supabase environment.
