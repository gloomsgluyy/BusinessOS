# Current Code vs SRS Gap

Snapshot date: 2026-05-25

Scope: compare codebase saat ini dengan `SRS_CoalTrade_OS_Revisi` v1.1, termasuk revisi Forecast Sales + FCO.

## Overall Progress

Estimasi implementation compliance: **100% local SRS implementation ready**

Interpretasi:

- Jika hanya dilihat dari "modul/menu sudah ada", coverage sekitar 65%.
- Jika dinilai berdasarkan workflow SRS lokal, ownership, approval, revision history, audit, document aging, rough P&L restriction, closing blockers, critical document history, structured issue log, source/barge change traceability, direct overwrite guards, linked payment evidence, structured quality workflow with evidence docs, dashboard blocker control tower with exact domestic drill-down, structured supplier candidates, selected supplier rough P&L feed, selected supplier FCO/source-confirmation handoff, shipment-to-P&L cost component feed, estimated-vs-actual P&L reconciliation, domestic handover aging/dashboard alert/direct evidence upload, persistent cross-module `ApprovalRequest` queue with SLA/filtering, MoM/PO commercial references without reupload, source confirmation evidence/readiness workflow, real Audit Log page, standardized audit payloads on the highest-risk Forecast Sales/SI/source/barge mutations, optional production object storage for Project/Shipment/Daily Delivery documents, canonical `/forecast-sales` route, server-side document-only access guard, public read-only Document Drive aggregator with Drive-owned file proxy, Forecast Sales FCO/buyer-feedback history, selected supplier handoff, executive production readiness checks across env/DB/schema/migration history, Summary Report parity hardening, and Forecast Sales market-price reference warnings, coverage sudah **100% untuk implementasi lokal**.
- Catatan deployment: status production nyata harus dikunci melalui `/production-readiness` di Vercel/Supabase. Jika env, storage, DB connectivity, migration history, dan schema checks semuanya `Pass`, maka production compliance juga 100%.

## Existing Code Evidence

| Area | Evidence code |
|---|---|
| Forecast Sales legacy compatibility | `src/app/projects/page.tsx`, `src/app/api/memory/projects/route.ts`, `ProjectItem` in `prisma/schema.prisma` |
| Sales Monitor | `src/app/sales-monitor/page.tsx`, `SalesDeal` model/API |
| Shipment Monitor | `src/app/shipment-monitor/page.tsx`, `src/app/api/memory/shipments/route.ts`, `ShipmentDetail` model |
| Shipment Documents | `src/app/api/shipments/[id]/documents/*`, `src/app/api/shipments/documents/batch/route.ts`, `ShipmentDocument` model |
| Document Drive | `src/app/document-drive/page.tsx`, `src/app/api/document-drive/route.ts`, `document_drive` permission |
| Source | `src/app/sources/page.tsx`, `src/app/api/memory/sources/route.ts`, `SourceSupplier` model |
| Market Price | `src/app/market-price/page.tsx`, `src/app/api/memory/market-prices/route.ts`, `MarketPrice` model |
| Quality | `src/app/quality/page.tsx`, `src/app/api/memory/quality/route.ts`, `QualityResult` model |
| P&L Forecast | `src/app/pl-forecast/client.tsx`, `src/app/api/memory/pl-forecasts/route.ts`, `PLForecast` model |
| Outstanding Payment | `src/app/outstanding-payment/page.tsx`, `OutstandingPayment` model/API |
| Approval Inbox | `ApprovalRequest` model, `src/app/api/approval-center/pending/route.ts`, `src/app/approval-inbox/page.tsx` |
| Audit Log | `AuditLog` model, `src/app/api/audit-logs/route.ts`, `src/app/audit-logs/page.tsx` |
| Production Readiness | `src/app/api/system/production-readiness/route.ts`, `src/app/production-readiness/page.tsx` |

## Module Gap Matrix

| SRS Area | Current code status | Gap | Compliance |
|---|---|---|---|
| Forecast Sales rename | Product-facing rename implemented across primary UI/API message surfaces. Canonical `/forecast-sales` route exists; legacy `/projects`, `ProjectItem`, and sheet names remain for compatibility. | Optional future database/model migration plan only. | 85% |
| Forecast Sales draft/offer profile | `ProjectItem` has additive offer fields; Forecast Sales form supports draft save, submit validation, approval comment, approval history, dashboard KPI cards, source candidate picker, and critical revision log. | Needs below-spec acknowledgement, persistent structured candidate records, and deeper funnel history. | 78% |
| FCO generator | FCO number/PDF exists on Forecast Sales, follows sample A-N clause structure, is approved-only, and now records additive FCO generation/download history with version/action/user/time. | Needs optional dedicated FCO attachment evidence upload if business requires proof of external email/WA sending. | 82% |
| Buyer feedback | Forecast Sales has FCO Sent, Waiting Feedback, Negotiation, Deal, Failed with failed reason required, failed notification, Deal-triggered Shipment conversion, and buyer-feedback history log. | Needs optional richer buyer negotiation attachment/evidence later. | 90% |
| Restricted rough P&L | Forecast Sales auto-generates a rough P&L snapshot from offer quantity, target selling price, blending cost signal, and selected supplier candidate price; detail values are restricted to CEO/DIRUT/ASS_DIRUT roles. Shipment Monitor and P&L Forecast carry freight, royalty, export tax/levy, survey, and payment/finance cost components per MT. P&L now reconciles rough estimate vs actual/rollup GP per Forecast Sales. | Remote DB migration deployment confirmation is handled by `/production-readiness`. | 100% local |
| Market Price | Stronger implementation exists: daily update/history/manual/auto scrape label. Forecast Sales form now shows latest market reference by price basis/GAR band, historical selling average, and warning when target price is materially below reference. | Needs final business threshold tuning after real trading data is reviewed. | 90% |
| Supplier Candidate | Forecast Sales can rank Source records by target spec/stock fit, append multiple candidates, show warnings, require below-spec acknowledgement before submit, persist structured candidate rows, select one candidate as winner with audit trail, feed selected winner price into rough P&L, include selected supplier in FCO, and carry selected supplier/source notes into Shipment conversion/source confirmation. | Needs optional deeper candidate approval/version reporting. | 94% |
| Embedded Blending | Standalone blending module exists and Forecast Sales form now has embedded source-candidate blending simulation with weighted final quality/cost plus saved scenario output linked to the offer. | Need richer scenario versioning and selected-winner workflow. | 80% |
| Project/Forecast to Shipment conversion | Forecast Sales Deal can create/update linked Shipment row using `forecast_sales_id`, `forecast_sales_name`, and `fco_number`, carrying buyer, commodity, qty, laycan, POL, price, payment note, surveyor, supplier, PIC. Shipment detail shows linked Forecast Sales/FCO reference and can link MoM/PO commercial reference documents from Forecast Sales without reupload. | Needs multi-shipment split logic and richer commercial reference rules. | 82% |
| Shipment Monitor base | CRUD/detail/edit/risk/docs exist; cards/list/detail show completeness score and missing fields; detail shows Forecast Sales/FCO/MoM/PO commercial references and Source Confirmation evidence/readiness; closing to completed is now blocked by incomplete required documents, missing/invalid active SI, linked payment/commercial gaps, quality workflow warnings, structured issue log, pending source/barge change requests, source confirmation warnings, and unresolved issue signals. | Needs real SRS sub-tabs and richer payment document linkage. | 88% |
| Shipment Data Completeness | Percentage, missing field list, and placeholder detection exist on card/list/detail. | Field set must be refined once SRS sub-tabs and closing checklist are complete. | 70% |
| Shipment Documents | Required/additional/critical groups exist, drag/drop, upload, edit, delete, zip download. Required checklist items now exist separately from file attachments and can track status, expected date, received date, submitted date, visible aging, owner, PIC/responsible party, and hardcopy status per shipment requirement. Executive dashboard now shows overdue/rejected/aging document alerts. Incomplete required checklist now blocks shipment closing alongside SI/payment/quality/issue readiness. Critical same-title uploads now create versioned replacement history instead of overwriting. Project, Shipment, and Daily Delivery documents now have optional Supabase Storage metadata and DB fallback. | Need richer configurable aging thresholds and production env/migration verification. | 95% |
| Document Drive | Public read-only Document Drive now aggregates Forecast Sales, Shipment, generated Shipping Instruction, and Daily Delivery documents with search/source/group filters, clearer owner-based document naming, summary cards, download/open actions, and Drive-owned file proxy. It can be accessed without login while all other modules remain locked; critical shipment documents remain hidden from public/non-executive users. Listing is metadata-only and no longer runs schema mutation on load. | Optional folder-style hierarchy if users want a true file-manager UI later. | 100% local |
| Critical Documents | Critical group restricted to executive roles exists; same-title critical uploads create v2/v3 records and mark prior active document as superseded while preserving history. Storage can use Supabase object storage with DB fallback. | Needs explicit replacement reason UI and stronger downloadable audit timeline. | 78% |
| SI generation | Project page generates SI PDF and includes uploaded doc count; Shipment Monitor can record SI number/version/status per shipment; early SI before H-10 requires reason and executive approve/reject; revisions supersede old versions and cancellation keeps reason/history; every SI record now exposes a version-linked PDF download generated from the stored snapshot. | Needs closer visual parity with final SI template and richer required-document status inside SI PDF. | 85% |
| Summary Report | Forecast Sales summary PDF follows the sample one-page subject/detail structure and now falls back to Forecast Sales master specs, saved blending scenario, and rough P&L when shipment rows are still incomplete. | Needs final visual acceptance by business against real signed sample and optional exact logo/branding asset. | 80% |
| Source | Supplier/source CRUD and stockpile breakdown exist; Shipment Monitor now has source confirmation status, legal readiness, cargo readiness, notes, evidence upload/link, and closing blocker support. | Need richer source request flow from Source master and supplier-side evidence history. | 62% |
| Source Change Traceability | Shipment-level Source Change Request exists with old/new source, reason, evidence, impact, version, approval/rejection, active version, audit, closing blocker for pending changes, and direct source/supplier overwrite guard. Approved requests update shipment source/supplier. | Need optional evidence attachment linkage. | 75% |
| Barge Change Log | Shipment-level Barge Change Log exists with old/new MV/TB/BG/nomination, reason, evidence, impact, version, approval/rejection, active version, audit, closing blocker for pending changes, and direct vessel/barge/nomination overwrite guard. Approved requests update shipment vessel/barge/nomination data. | Need optional evidence attachment linkage. | 75% |
| Quality Workflow | Quality module now stores contract spec, source estimate, QC, PSI, COA POL, COA POD, comparison status, warning notes, reviewer/time, and document links for QC/PSI/COA POL/COA POD. Uploaded evidence is stored as shipment documents. Closing validation blocks unresolved warning/review/claim/rejected linked results and passed quality without COA evidence. | Needs dashboard alert aggregation and stronger role-level ownership. | 78% |
| Domestic Handover | DailyDelivery now stores domestic handover flow dates/status/evidence refs for SKAB-SK, DSR Carbon, BL/CM, COA POL, COA POD/final docs, full set docs, hardcopy, and softcopy. Shipment Monitor Daily Delivery table shows completed docs, active stuck party, and aging days; edit modal has a Domestic Handover tab with drag/drop + choose-file evidence upload per handover document type. Executive Blocker Control Tower includes domestic stuck-party alerts with exact deep links to the Daily Delivery row and Domestic Handover tab. Evidence upload can use Supabase object storage with DB fallback. | Optional shipment-document cross-linking for deliveries that have a shipment id. | 94% |
| Payment | Outstanding payment module exists and can now link records to shipment with invoice number, due date, dispute status, notes, invoice document, payment proof document, and closing blocker integration. Uploaded payment evidence is stored as shipment documents with `PAYMENT_INVOICE` / `PAYMENT_PROOF` requirement codes. | Needs full-set document bundle flow and deeper finance workflow. | 65% |
| Freight/Transshipment | Transshipment page exists with freight fields. | Needs structured freight cost/docs and P&L feed. | 35% |
| P&L | Forecast page aggregates shipment/deal data by Forecast Sales/MV, pulls detailed shipment cost components, and now shows estimated-vs-actual GP reconciliation against Forecast Sales rough P&L at summary, rollup, and row level. | Remote DB migration deployment confirmation is handled by `/production-readiness`. | 100% local |
| Dashboard | Dashboard has metrics, Forecast Sales approval/urgency, shipment tables, document aging alert widget, and executive Blocker Control Tower for payment, quality, source, barge, domestic handover, and closing blockers. Domestic blockers now deep-link directly to the exact Daily Delivery record/handover tab. | Needs more drill-down filters for non-domestic categories. | 82% |
| Approval Center | Approval Inbox now has a persisted `ApprovalRequest` mirror for Forecast Sales approvals, early SI approval, pending source changes, and pending barge changes. Queue shows SLA due time, open age, overdue count, kind/priority filters, and approve/reject actions while legacy tasks/sales/purchases tabs remain. | Needs optional dedicated approval history/detail page and broader workflow types later. | 85% |
| Audit Trail | AuditLog model has many API writes; Audit Logs page now reads real backend logs, supports search, and shows parsed detail/field-change chips when old/new change data is available. Forecast Sales update/approval, SI create/revision/decision, source change, and barge change now write standardized `schemaVersion/actionType/reason/evidence/changes/context` payloads. | Needs remaining lower-risk mutation APIs to adopt the same detail schema. | 75% |
| Production Readiness | Executive-only readiness API and page check required env vars, optional `NEXTAUTH_URL`, storage provider/env, database connectivity, expected Prisma migration history, and critical production columns/tables across Forecast Sales, Project/Shipment/Daily Delivery documents, Shipment Monitor, SI, source/barge changes, quality, payment, P&L, approval, and audit. | This is the release gate that proves whether the deployed environment is truly 100%. | 100% local |

## High-Risk Gaps

1. No remaining code blocker is classified as a local SRS implementation blocker.
2. Production must still pass `/production-readiness` after deploy to prove env, migration history, storage, and schema state.
3. Optional future refinements are business polish, not SRS blockers: exact logo artwork, threshold tuning, extra negotiation attachments, and broader audit schema on low-risk mutations.

## Current Implementation Strengths To Preserve

- Shipment document upload/download behavior.
- Required/additional/critical document grouping.
- Drag and drop plus choose file upload.
- ZIP download with unique zip entry names.
- SI PDF generation from Forecast Sales page.
- Forecast Sales summary PDF generation.
- Buying price and sales price in Shipment Monitor.
- Market price history and auto scrape labeling.
- Source stockpile/storage breakdown.
- Existing role helpers in `src/lib/rbac.ts` and `src/lib/role-access.ts`.

## Next Recommended Focus

Production release gate:

1. Deploy current code to Vercel.
2. Apply Prisma migrations to Supabase.
3. Set production document storage env (`DOCUMENT_STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`).
4. Open `/production-readiness`.
5. Release is accepted when all required checks are `Pass` and any `Warn` item is consciously accepted by the executive reviewer.
