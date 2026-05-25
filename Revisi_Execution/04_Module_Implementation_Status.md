# Module Implementation Status

Snapshot date: 2026-05-25

This file tracks implementation state by module. Update it whenever code changes materially.

## Legend

- `Done`: meets SRS acceptance criteria.
- `Partial`: feature exists but does not fully meet SRS.
- `Not Started`: no meaningful implementation.
- `Legacy`: exists under older concept and must be migrated/renamed.
- `Risk`: implementation can break if refactored carelessly.

## Summary

| Module | Status | Main evidence | Main gap |
|---|---|---|---|
| Dashboard | Done/Strong | `src/app/page.tsx`, `/api/dashboard/blockers` | Has Forecast Sales approval/urgency, document aging alerts, and executive blocker control tower for payment/quality/source/barge/domestic handover/closing; domestic handover alerts deep-link to the exact Daily Delivery row/handover tab |
| Partners & Directory | Partial | `src/app/directory/*`, `Partner` model | Needs dropdown integration across modules |
| Market Price | Done/Strong | `src/app/market-price/page.tsx`, `MarketPrice` model, `src/app/projects/page.tsx` | Daily update/history/manual/auto scrape exists; Forecast Sales now shows latest market reference, historical selling average, target gap, and below-reference warning; remaining work is business threshold tuning |
| Forecast Sales | Partial/Legacy | `src/app/forecast-sales/page.tsx`, `src/app/projects/page.tsx`, `ProjectItem`, `ProjectSupplierCandidate`, `SalesDeal` | Canonical route, rename, offer profile, approval history, FCO PDF/history, buyer feedback/history, failed notification, Deal -> Shipment conversion, dashboard cards/drill-down, Source candidate picker, structured candidate rows, selected supplier winner, selected winner rough P&L feed, selected supplier FCO/source-confirmation handoff, fit score, below-spec acknowledgement, embedded/saved blending simulation, revision log, and restricted rough P&L done |
| Sales Monitor | Partial | `src/app/sales-monitor/page.tsx` | Should become funnel monitoring layer |
| Shipment Monitor | Partial | `src/app/shipment-monitor/page.tsx`, `ShipmentDetail`, `ShipmentIssueLog`, `ShipmentSourceChangeRequest`, `ShipmentBargeChangeLog` | Can receive linked Forecast Sales deal rows, shows data completeness score, displays Forecast Sales/FCO/MoM/PO commercial reference, source confirmation readiness/evidence, structured issue log plus source/barge change requests, and blocks closing when required docs/SI/linked payment/quality workflow/issues/source/barge/source confirmation are incomplete; still needs SRS sub-tabs |
| Shipment Documents | Done/Strong | `ShipmentDocument`, `ShipmentDocumentChecklistItem`, `src/lib/document-storage.ts`, documents routes | Checklist item model, visible aging, owner/PIC, hardcopy status, dashboard aging alert, closing blocker integration, critical replacement history, and optional Supabase object storage with DB fallback exist |
| Document Drive | Done/Strong | `src/app/document-drive/page.tsx`, `/api/document-drive`, `/api/document-drive/files`, `document_drive` permission | Public read-only aggregator for Forecast Sales, Shipment, generated SI, and Domestic Handover documents exists; logged-out/document-only users get only Document Drive surface; visible files and generated SI PDFs download through Drive proxy; critical docs stay executive-only; listing is metadata-only for faster load |
| Source | Partial/Strong | `src/app/sources/page.tsx`, `SourceSupplier`, Shipment source confirmation fields | Source CRUD/stockpile exists; Shipment Monitor has source confirmation status, legal/cargo readiness, notes, evidence upload/link, and closing blocker support; still needs richer source request workflow from Source master |
| Source Change Traceability | Partial/Strong | `ShipmentSourceChangeRequest`, `/api/shipments/[id]/source-changes` | Request/approval/version/active source exists and direct source/supplier overwrite is blocked; still needs evidence attachment linkage |
| Quality | Partial/Strong | `src/app/quality/page.tsx`, `QualityResult`, `ShipmentDocument` | Contract/source/QC/PSI/COA POL/COA POD sections, comparison warning, and QC/PSI/COA document evidence links exist; needs dashboard aggregation |
| Blending | Partial | `src/app/blending/page.tsx`, `BlendingSimulation` | Needs embedding in Forecast Sales |
| SI Management | Partial/Strong | SI PDF in `src/app/projects/page.tsx`, `ShippingInstructionRecord`, SI record PDF route | SI entity/version/status, H-10 early approval, revision supersede, cancellation, and version-linked PDF download exist; needs final visual/template parity |
| Barge Change Log | Partial/Strong | `ShipmentBargeChangeLog`, `/api/shipments/[id]/barge-changes` | Request/approval/version/active MV/TB/BG/nomination exists and direct vessel/barge/nomination overwrite is blocked; still needs evidence attachment linkage |
| Domestic Handover | Done/Strong | `DailyDelivery` model, `DailyDeliveryDocument`, `src/lib/document-storage.ts`, `src/app/shipment-monitor/page.tsx`, `src/app/api/memory/daily-delivery/route.ts`, `src/app/api/daily-delivery/[id]/documents`, `/api/dashboard/blockers` | SKAB/DSR/BL-CM/COA POL/COA POD/final docs flow dates, stuck party, aging, full set/hardcopy/softcopy status, direct evidence upload/download/delete, optional object storage, and executive dashboard exact-row alerts exist |
| Transshipment/Freight | Partial | `src/app/transshipment/page.tsx` | Needs structured cost/docs/P&L feed |
| Outstanding Payment | Partial/Strong | `src/app/outstanding-payment/page.tsx`, `OutstandingPayment`, `ShipmentDocument` | Shipment link, invoice number, due date, dispute status, notes, invoice document, payment proof document, and closing impact exist; needs full-set/payment bundle workflow |
| P&L | Done/Strong | `src/app/pl-forecast/client.tsx`, `src/app/api/memory/pl-forecasts/route.ts`, `src/lib/sheets-first-service.ts` | Pulls shipment-level buying/freight/royalty/tax/survey/payment/other cost components into Forecast Sales/MV P&L and reconciles actual/rollup GP against Forecast Sales rough P&L estimates |
| Approval Center | Done/Strong | `ApprovalRequest` model, `src/app/approval-inbox/page.tsx`, `/api/approval-center/pending` | SRS Queue persists Forecast Sales approval, early SI approval, source change, and barge change rows with SLA due date, open age, overdue count, kind/priority filters, and approve/reject actions |
| Audit Trail | Partial/Strong | `AuditLog` model, `/api/audit-logs`, `src/app/audit-logs/page.tsx` | Audit page reads real backend logs with search and parsed detail/field-change chips; Forecast Sales update/approval, SI create/revision/decision, source change, and barge change now write standardized old/new/reason/evidence payloads; lower-risk mutation APIs can be standardized gradually |
| Production Readiness | Done/Strong | `/api/system/production-readiness`, `src/app/production-readiness/page.tsx` | Executive checker validates required env vars, optional `NEXTAUTH_URL`, storage provider/env, DB connection, expected Prisma migration history, and critical production schema columns across SRS modules; actual remote migration/env setup must still be completed on Vercel/Supabase |

## Module Notes

### Forecast Sales

Current code:

- `src/app/projects/page.tsx` is the closest legacy page.
- `ProjectItem` model exists with name, segment, buyer, status, checklist, approval fields, and additive Forecast Sales offer fields.
- `SalesDeal` model exists with deal number, status, buyer, type, shipping terms, quantity, price, laycan, specs.

Implemented in current revision:

- Product-facing rename is done across primary UI surfaces while keeping `/projects` and `ProjectItem` for compatibility.
- Offer profile core fields exist for buyer/country/commodity/qty/laycan/POL/sales term/target price/price basis/payment/surveyor/spec.
- Submit Offer Profile blocks missing mandatory fields, while Save Draft remains allowed.
- Supplier candidate text field exists and can now be populated from ranked Source records with initial quality/stock fit score.
- Below-spec/low-fit candidates require acknowledgement reason before Submit Offer Profile.
- Embedded blending simulation exists in the Forecast Sales form using Source candidates.
- Blending scenario output can be saved to Forecast Sales and shown in detail modal.
- Approval decision supports approved/revision/rejected with mandatory comment and visible history.
- Restricted rough P&L snapshot is generated on Forecast Sales create/update and shown only to CEO/DIRUT/ASS_DIRUT detail view.
- FCO number/PDF generator exists, follows the provided sample clause structure, and is blocked unless approved.
- Buyer feedback workflow exists: FCO Sent, Waiting Feedback, Negotiation, Deal, Failed with failed reason required.
- Failed offers surface in management header notifications.
- Deal can create/update a linked Shipment row with Forecast Sales/FCO reference and carried commercial fields.
- Dashboard KPI cards exist for total, draft, CEO review, approved, FCO sent, buyer pending, deal, failed, revenue, and shipment GP; financial cards are role-restricted.
- Dashboard KPI cards now expand into drill-down lists showing project name, buyer, offer by, and current status/feedback.
- Dashboard now shows an initial syncing state instead of false zero values while production data is still loading.
- `/api/memory/projects` keeps compatibility schema guards but avoids repeated hot-path `ALTER TABLE` scans by checking missing columns and caching the result per server instance.
- Critical revision log exists for quantity, laycan, target selling price, and supplier candidates, storing old/new values, reason, user, and timestamp.

Latest implementation note:

- 2026-05-23: FS-001 completed. Sidebar/header/dashboard/Forecast Sales page/Sales Monitor/Shipment Monitor/P&L/chatbot/API-facing messages now use Forecast Sales labels where user-facing.
- 2026-05-23: FS-002 and FS-003 completed. `ProjectItem` now has additive offer profile fields; Forecast Sales form supports Save Draft and Submit Offer Profile validation.
- 2026-05-23: FS-004 completed. Approval actions now require CEO/DIRUT/ASS_DIRUT role, mandatory comment, and append visible approval history.
- 2026-05-23: FS-005 and FS-006 completed. FCO PDF generation follows the sample clause structure and is approved-only.
- 2026-05-23: FS-007 completed. Buyer feedback status and failed reason flow added.
- 2026-05-23: FS-008 completed. Failed Forecast Sales offers now appear in management header notifications.
- 2026-05-23: FS-009 completed. Shipment rows can be created/updated from Forecast Sales Deal status and linked by `forecast_sales_id`.
- 2026-05-23: FS-010 completed. Forecast Sales dashboard cards added with CEO-only financial values.
- 2026-05-23: FS-012 completed and FS-013 partial. Forecast Sales form now ranks Source candidates by target spec/stock fit and can append them to supplier candidate notes.
- 2026-05-24: FS-011 completed. Critical Forecast Sales updates now append revision history and require reason after draft.
- 2026-05-24: FS-013 and FS-014 completed. Supplier candidate fit warning now gates Submit Offer Profile with below-spec acknowledgement reason.
- 2026-05-24: FS-015 completed. Forecast Sales form now has embedded blending simulation with weighted final quality and average cost.
- 2026-05-24: FS-016 completed. Embedded blending scenario output can now be saved to the Forecast Sales record.
- 2026-05-24: FS-017 completed. Forecast Sales now stores an auto-generated rough P&L snapshot and displays revenue/cost/margin values only to executive approval roles.
- 2026-05-24: FS-012 strengthened. Forecast Sales now has persistent `ProjectSupplierCandidate` rows with fit score, warning, source quality/stock/price snapshot, version, audit, and selected winner.
- 2026-05-24: FS-012 strengthened again. Selected supplier candidate price now feeds the restricted rough P&L snapshot.
- 2026-05-24: APR-001 partial/strong. Approval Inbox now has an SRS Queue aggregating Forecast Sales approval, early SI approval, source change, and barge change with approve/reject actions.
- 2026-05-24: SH-003 partial/strong. Shipment Monitor can link MoM/PO commercial references to Forecast Sales `ProjectDocument` files without reupload and exposes direct download links in shipment detail.
- 2026-05-24: SCT-003 done/strong. Shipment Monitor can track source confirmation, legal readiness, cargo readiness, notes, confirmation actor/time, and evidence document link; confirmed source without evidence can block closing.
- 2026-05-24: AUD-001 partial/strong. Audit Logs now reads real backend logs through `/api/audit-logs`, supports search, and renders parsed details/change chips instead of demo data.
- 2026-05-24: PAY-001 strengthened. Outstanding Payment can link records to shipment, attach invoice/payment proof into shipment documents, and unpaid/disputed/missing-evidence linked records block shipment closing.
- 2026-05-24: QLT-001 completed and QLT-002 partial/strong. Quality records now include contract spec, source estimate, QC, PSI, COA POL, COA POD, comparison status, warning notes, reviewer/time, evidence document links, and linked warning/review/claim/rejected or missing-COA results block shipment closing.
- 2026-05-25: PL-001 strengthened. Shipment Monitor can store freight, royalty, export tax/levy, survey, and payment/finance cost per MT; P&L Forecast consumes those components in rollup, form, API, store, and Sheets cache mapping. Local Prisma client generated; remote Supabase migration apply is blocked by database connectivity (`P1001`).
- 2026-05-25: DOM-001 partial/strong. Daily Delivery now has Domestic Handover tracking for SKAB-SK, DSR Carbon, BL/CM, COA POL, COA POD/final docs, full set, hardcopy, and softcopy; table surfaces active stuck party and aging.
- 2026-05-25: DSH-001 strengthened. Executive Blocker Control Tower now includes domestic handover stuck-party alerts and summary counts.
- 2026-05-25: DOM-001 done/strong. Domestic Handover now has `DailyDeliveryDocument` evidence storage and drag/drop + choose-file upload/download/delete per SKAB, DSR, BL/CM, COA POL, and COA POD/final docs.
- 2026-05-25: DSH-001 done/strong. Domestic dashboard alerts now deep-link to `Shipment Monitor > Daily Delivery > Domestic Handover` for the exact row.
- 2026-05-25: APR-001 done/strong. Approval Inbox now persists SRS approval queue rows in `ApprovalRequest`, adds SLA/open-age metadata, overdue count, and kind/priority filters.
- 2026-05-25: AUD-002 partial/strong. Forecast Sales update/approval, SI create/revision/decision, source change, and barge change audit logs now use a standardized `schemaVersion/actionType/reason/evidence/changes/context` payload shape.
- 2026-05-25: DOC-007 done/strong. Project, Shipment, and Daily Delivery document routes now use `src/lib/document-storage.ts` for optional Supabase object storage with DB fallback; ZIP/download routes read from the correct storage backend.
- 2026-05-25: DOC-008 done/strong. Document Drive now aggregates Forecast Sales, Shipment, and Domestic Handover documents with search/source/group filters and direct open/download actions.
- 2026-05-25: FS-018 done. Forecast Sales dashboard KPI cards now have drill-down dropdowns for project/status visibility and show who offered each record.
- 2026-05-25: FS-001 strengthened. `/forecast-sales` is now the canonical user-facing route and `/projects` redirects to it while preserving legacy APIs/models.
- 2026-05-25: DOC-009 done. Document Drive file links now use a Drive-owned proxy endpoint so document-only users can download visible non-critical files without module-route permissions.
- 2026-05-25: FS-005/FS-007 strengthened. Forecast Sales now stores additive `fcoHistory` and `buyerFeedbackHistory` logs and shows them in the detail modal.
- 2026-05-25: FS-012 strengthened. Selected structured supplier now appears in the generated FCO and carries into Shipment conversion as supplier/source plus source confirmation notes.
- 2026-05-25: SYS-001 done/strong. Executive Production Readiness page and API now check production env/storage settings, DB connectivity, expected Prisma migrations, and critical migration columns.
- 2026-05-25: FS-019 done/strong. Summary Report now uses Forecast Sales master spec, saved blending scenario, and rough P&L fallbacks so the sample structure stays useful before shipment data is fully populated.
- 2026-05-25: FS-020 done/strong. Forecast Sales form now includes market reference/historical selling price comparison and warns when target selling price is below reference.
- 2026-05-25: PL-001 done/strong. P&L Forecast now shows estimated-vs-actual GP variance using Forecast Sales rough P&L as estimate and shipment/P&L rollup as actual.
- 2026-05-25: DOC-008/DOC-009 strengthened. Document Drive is now public read-only, includes generated SI PDFs, uses clearer owner-based names, and avoids schema mutation during listing for faster load.
- 2026-05-25: FS-018 strengthened. Forecast Sales dashboard cards are wider and no longer visually stretch all summary cards when one drilldown is opened.
- 2026-05-25: Forecast Sales production load guard added. Project API compatibility checks now only alter missing columns, cache the guard per server instance, return no-store responses, and the page shows syncing state during initial load.
- Legacy `ProjectItem`, `/projects`, `project_name`, and sheet tab compatibility remain intentionally unchanged.

Implementation approach:

- Do not delete `ProjectItem` immediately.
- Use compatibility adapter: product label Forecast Sales, legacy model still ProjectItem if needed.
- Add fields gradually or create new ForecastSales models with migration plan.

### Project Legacy Features To Preserve

Current valuable features in `src/app/projects/page.tsx`:

- Project grouping by MV/project name.
- Child shipment list.
- SI PDF download.
- Required document download dropdown/zip.
- Summary report PDF.
- Project approval status.
- Project urgent analysis.

Risk:

- Rename to Forecast Sales must not break SI and summary download.

### Shipment Documents

Current code:

- `ShipmentDocument` model stores file bytes in DB.
- Document groups: `required`, `additional`, `critical`.
- Critical documents restricted to executive roles.
- Upload supports drag/drop and choose file.
- File types allowed: image, PDF, DOCX.
- ZIP download exists.

Gaps:

- Checklist item entity exists as `ShipmentDocumentChecklistItem`.
- Required shipment checklist is seeded per shipment and remains separate from uploaded files.
- Uploading a required file updates the matching checklist status/count without overwriting attachment records.
- Shipment Monitor can update checklist status per requirement.
- Expected/received/submitted dates can be edited from Shipment Monitor.
- Required document cards show aging: pending target date, due/overdue, received aging, submitted aging, or no aging.
- Owner role, PIC/responsible party, and hardcopy status can be edited per required checklist item.
- Executive dashboard shows document aging alerts from checklist data.
- Critical document same-title upload creates a new version, supersedes the prior active critical document, and preserves old file history.

Remaining gaps:

- Closing blocker now exists across required documents, active SI, linked payment/commercial readiness, quality workflow warnings/readiness, unresolved issue signals, pending source changes, and pending barge changes.
- Explicit critical replacement reason UI is still basic; current reason comes from notes or default replacement text.
- Aging thresholds are hardcoded and should become configurable later.
- File storage in DB is acceptable for testing but not production.

Preserve:

- Existing upload/download UX.
- Existing required/additional/critical grouping.

### Shipment Monitor

Current code:

- `ShipmentDetail` model has many operational fields.
- Shipment cards/list/detail show Data Completeness percentage and missing fields.
- Detail modal shows linked Forecast Sales/FCO commercial reference when available.
- Detail modal can record Shipping Instruction v1/revisions against the shipment.
- Early SI before H-10 requires reason and executive approve/reject decision.
- New SI revisions supersede previous active SI without deleting it; SI can be cancelled with reason.
- SI records expose version-linked PDF downloads generated from stored shipment snapshots.
- Completed/closed shipment status is blocked when required document checklist items are still pending/received/rejected, no valid active SI exists, payment/commercial data is incomplete, quality is not ready, or unresolved issue signals remain open.
- Edit modal includes SI fields, commercial fields, quality basics, operational info, demurrage.
- Edit modal includes payment status/due date, invoice number, quality status, and issue status controls for closing readiness.
- Detail overview includes structured Issue Log records with category, impact, action, PIC, target date, status, and evidence.
- Detail overview includes Source Change Request records with old/new source, reason, evidence, impact, status, version, and executive approve/reject.
- Detail overview includes Barge Change Log records with old/new MV/TB/BG/nomination, reason, evidence, impact, status, version, and executive approve/reject.
- Detail modal has tabs: overview, documents, blending details, timeline, risk analysis.

Gaps:

- SRS needs sections: Header, Commercial, Source, Source Change, Quality, SI, Nomination, Barge Change, POL, POD, Documents, Payment, Issue, Closing.
- Completion percentage exists; field set should be refined as SRS sub-tabs mature.
- Closing validation currently covers required document checklist, active SI, payment/commercial readiness, quality readiness, structured issue log, pending source/barge change requests, and free-text issue signals.
- No no-overwrite change logs.

### Market Price

Current code:

- Daily market price history.
- Manual update.
- Auto scrape label.
- History table.

Gaps:

- Needs direct Forecast Sales integration.
- Needs historical selling price reference in offer workflow.

### Source

Current code:

- Source/supplier CRUD.
- Stock/storage locations with total MT.
- Quality specs and FOB barge price.

Gaps:

- Source confirmation from shipment.
- Evidence upload.
- Legal/cargo readiness workflow.
- Source change approval and active version.

### Approval and Audit

Current code:

- Approval Inbox exists but handles tasks/sales orders/purchases.
- `AuditLog` model exists.
- Some APIs write audit logs.
- SRS approval queue now persists rows in `ApprovalRequest` for Forecast Sales, early SI, source change, and barge change.
- Approval Inbox shows SLA due time, open age, overdue count, and kind/priority filters while reusing the workflow-specific approve/reject endpoints.
- Highest-risk mutation APIs now include structured audit details with reason/evidence and explicit old/new changes.

Gaps:

- Extend the standardized old/new/reason/evidence audit schema to remaining lower-risk mutation APIs.
- Audit Logs page already reads real backend logs, but not every mutation API writes consistent structured details yet.

## Update Rule

When an item changes from Partial to Done, add:

- date,
- implementation files,
- verification command/result,
- known limitation,
- related SRS requirement IDs.
