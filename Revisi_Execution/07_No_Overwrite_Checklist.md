# No Overwrite Checklist

Use this checklist before changing code.

## Last Safety Record

### 2026-05-23 - FS-001 Forecast Sales Rename

- `git status --short --branch` checked before edit.
- Relevant SRS and Revisi Execution docs read.
- Current code searched with `rg`.
- Product-facing labels changed only; no destructive route/model/database rename.
- Preserved `/projects`, `ProjectItem`, `project_name`, Google Sheet `Projects` compatibility, SI PDF, summary PDF, shipment documents, and ZIP download.
- Verification run: `npx tsc --noEmit` passed.

### 2026-05-23 - FS-002/FS-003 Offer Profile Foundation

- Additive fields only on `ProjectItem`; no destructive model/route rename.
- Preserved `/projects`, SI PDF, summary PDF, shipment document download, and existing document grouping.
- Draft can be saved incomplete.
- Submit Offer Profile validates mandatory fields before moving to `waiting_approval`.
- Verification run: `npx prisma generate`, `npx tsc --noEmit`, and `GET /projects` returned 200.

### 2026-05-23 - FS-004 Offer Approval Workflow

- Additive `approvalHistory` field only; no destructive status/model migration.
- Approval actions are restricted to CEO/DIRUT/ASS_DIRUT.
- Approve, revision, and reject require an approval comment.
- Approval history is appended, not overwritten.
- Preserved current SI/Summary/document behavior.
- Verification run: `npx prisma generate`, `npx tsc --noEmit`, and `GET /projects` returned 200.

### 2026-05-23 - FS-005/FS-006 Basic FCO Generator

- Additive FCO fields only: `fcoNumber`, `fcoGeneratedAt`.
- FCO download is blocked unless Forecast Sales is approved.
- Basic FCO PDF pulls from approved offer profile.
- Preserved SI PDF, summary PDF, and shipment document behavior.
- Verification run: `npx prisma generate`, `npx tsc --noEmit`, and `GET /projects` returned 200.

### 2026-05-23 - FS-005 FCO Template Hardening

- FCO output now follows the provided sample structure: title, date/no/to/attention, opening statement, clauses A-N, coal quality table, validity, and signature.
- No existing SI/Summary/document behavior changed.
- Verification run: `npx tsc --noEmit` and `GET /projects` returned 200.

### 2026-05-23 - FS-007 Buyer Feedback Flow

- Additive buyer feedback fields only: status, reason, updated timestamp.
- Failed buyer feedback requires a reason at API and UI level.
- Preserved existing Forecast Sales, FCO, SI, summary, and document behavior.
- Verification run: `npx prisma generate`, `npx tsc --noEmit`, and `GET /projects` returned 200.

## 1. Before Editing

- [ ] I ran `git status --short --branch`.
- [ ] I identified untracked/modified files that are not mine.
- [ ] I read the latest user request.
- [ ] I read relevant SRS files.
- [ ] I read relevant Revisi Execution files.
- [ ] I searched current code with `rg`.
- [ ] I identified existing behavior that must be preserved.
- [ ] I identified whether a field/model/route is legacy compatibility or target architecture.
- [ ] I know which files I will edit.

## 2. Feature Preservation Checklist

Do not break these existing useful features:

- [ ] Shipment document upload.
- [ ] Drag and drop document upload.
- [ ] Choose file upload.
- [ ] Required/additional/critical document groups.
- [ ] Critical document role restriction.
- [ ] Single document download.
- [ ] Download-all ZIP.
- [ ] SI PDF generation from current Project/Forecast Sales page.
- [ ] Summary report PDF generation.
- [ ] Market price manual update/history.
- [ ] Auto scrape label for market price.
- [ ] Source stockpile/storage breakdown.
- [ ] Shipment buying price/sales price/margin fields.

## 3. Rename Safety

For `Projects` -> `Forecast Sales`:

- [ ] Product-facing labels can change.
- [ ] Legacy data must still load.
- [ ] Existing `/projects` route can remain temporarily unless a redirect is implemented.
- [ ] `ProjectItem` database model should not be destructively renamed without migration.
- [ ] SI and summary report buttons must still work after rename.

## 4. Document Module Safety

Before touching document code:

- [ ] Check `ShipmentDocument` model.
- [ ] Check `src/app/api/shipments/[id]/documents/route.ts`.
- [ ] Check `src/app/api/shipments/[id]/documents/[docId]/route.ts`.
- [ ] Check `src/app/api/shipments/[id]/documents/download-all/route.ts`.
- [ ] Check `src/app/api/shipments/documents/batch/route.ts`.
- [ ] Check document UI in `src/app/shipment-monitor/page.tsx`.
- [ ] Preserve file type validation.
- [ ] Preserve role guard for critical documents.
- [ ] Preserve soft delete.

## 5. Traceability Safety

For these changes, never only update the current field:

- [ ] Source/supplier change.
- [ ] MV/TB/BG nomination change.
- [ ] SI revision.
- [ ] SI cancellation.
- [ ] FCO revision.
- [ ] Forecast Sales price change after submit/approval.
- [ ] Forecast Sales laycan change after submit/approval.
- [ ] Critical document replacement.

Required trace fields:

- old value,
- new value,
- reason,
- evidence if required,
- requested by,
- approved by if required,
- timestamp,
- status,
- active version.

## 6. Approval Safety

Before implementing approval:

- [x] Check existing `approval-inbox`.
- [x] Determine if generic `ApprovalRequest` is needed.
- [x] Do not reuse sales order/purchase approval as if it already satisfies SRS.
- [x] Approval must store comment/reason.
- [x] Rejection must block related action.
- [x] Approval history must remain visible.

## 7. Audit Safety

For critical fields:

- [ ] Store old value.
- [ ] Store new value.
- [ ] Store module/entity.
- [ ] Store user and timestamp.
- [ ] Store reason if required.
- [ ] Store approval reference if any.
- [ ] Update real audit page eventually; do not rely on demo logs.

## 8. End-of-Work Checklist

- [ ] Code compiles or relevant verification was run.
- [ ] Manual workflow was checked if UI changed.
- [ ] `03_Execution_Backlog.md` updated.
- [ ] `04_Module_Implementation_Status.md` updated if module status changed.
- [ ] `06_Implementation_Log.md` updated.
- [ ] SRS updated if requirement changed.
- [ ] Final response mentions what changed and what was not changed.

## 9. 2026-05-23 FS-008/FS-009 Safety Record

- [x] Used additive Shipment fields only: `forecastSalesId`, `forecastSalesName`, `fcoNumber`.
- [x] Did not rename `/projects`, `ProjectItem`, or existing shipment document routes/models.
- [x] Preserved SI, Summary, required document download, drag/drop upload, and ZIP behavior.
- [x] Deal -> Shipment conversion creates/updates linked Shipment rows without touching `ShipmentDocument`.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 10. 2026-05-23 FS-010 Safety Record

- [x] Added page-level Forecast Sales dashboard cards without changing existing filters/list/detail modal.
- [x] Used existing `projects` and `cards` derivations; did not create duplicate data source.
- [x] Restricted revenue and shipment GP display to executive role logic already used by the page.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 11. 2026-05-23 FS-012/FS-013 Safety Record

- [x] Reused existing `SourceSupplier` data from commercial store.
- [x] Did not change Source schema or overwrite existing supplier data.
- [x] Stored selected candidates in existing `supplier_candidates` text field for compatibility.
- [x] Added warning/fit score display without blocking old drafts.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 12. 2026-05-23 SH-002 Safety Record

- [x] Added computed completeness only; did not mutate existing shipment records.
- [x] Did not touch `ShipmentDocument` upload/download APIs.
- [x] Preserved card, list, and detail modal workflows.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 13. 2026-05-24 FS-011 Safety Record

- [x] Added additive `revisionHistory` field; did not overwrite existing approval history.
- [x] Logged old/new values for quantity, laycan, target selling price, and supplier candidates.
- [x] Required revision reason for critical changes after draft.
- [x] Displayed revision log without changing existing Forecast Sales detail actions.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 14. 2026-05-24 FS-013/FS-014 Safety Record

- [x] Added additive below-spec acknowledgement fields only.
- [x] Did not change existing Source records or supplier candidate text compatibility.
- [x] Enforced acknowledgement at UI and API level for `waiting_approval`.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 15. 2026-05-24 SH-003 Safety Record

- [x] Added read-only Commercial Reference panel in Shipment detail.
- [x] Did not copy/upload Forecast Sales/FCO document into Shipment documents.
- [x] Preserved existing shipment document upload/download APIs.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 16. 2026-05-24 FS-015 Safety Record

- [x] Added in-form blending simulation only; did not alter standalone blending module behavior.
- [x] Reused existing Source candidate data.
- [x] Did not mutate Forecast Sales records until future save-scenario work.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 17. 2026-05-24 FS-016 Safety Record

- [x] Added additive `blendingScenario` field only.
- [x] Stored scenario as JSON on Forecast Sales for compatibility.
- [x] Did not change standalone blending history behavior.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.

## 18. 2026-05-24 SI-001 Safety Record

- [x] Added additive `ShippingInstructionRecord` model.
- [x] Did not remove existing Project-page SI PDF download.
- [x] Did not change shipment document upload/download APIs.
- [x] Added SI version history in Shipment Monitor as separate entity records.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 19. 2026-05-24 SI-002 Safety Record

- [x] Added additive early approval fields to SI records.
- [x] Did not remove existing SI PDF download.
- [x] H-10 early SI creates pending approval status instead of silently approving.
- [x] Executive approve/reject action requires comment.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 20. 2026-05-24 SI-003 Safety Record

- [x] Added additive cancellation fields to SI records.
- [x] New revision marks prior active SI as `superseded`; no deletion/overwrite.
- [x] SI cancellation stores reason/user/time instead of soft deleting the record.
- [x] Existing SI PDF download remains unchanged.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 21. 2026-05-24 DOC-002 Safety Record

- [x] Added additive `ShipmentDocumentChecklistItem` model; did not remove or rename `ShipmentDocument`.
- [x] Checklist records are separate from uploaded file records.
- [x] Required checklist seeding uses shipment + document code and does not delete existing uploaded files.
- [x] Uploading a required file updates checklist status/count while preserving all file attachments.
- [x] Existing required/additional/critical upload, edit, delete, and ZIP download behavior remains in place.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 22. 2026-05-24 DOC-003 Safety Record

- [x] Added date/aging behavior on checklist records only; did not alter uploaded file bytes.
- [x] Status updates can auto-fill received/submitted dates, but explicit user dates remain accepted.
- [x] Aging display is derived from checklist dates and does not mutate old shipment data.
- [x] Existing document upload/download/delete/ZIP flows remain unchanged.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 23. 2026-05-24 DOC-004 Safety Record

- [x] Added owner/PIC/hardcopy controls on checklist records only.
- [x] Did not change file upload storage, download URLs, delete behavior, or ZIP generation.
- [x] Required document owner defaults remain additive and editable per shipment.
- [x] Critical/additional document sections remain preserved.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.

## 24. 2026-05-24 DOC-005 Safety Record

- [x] Added read-only document aging alert endpoint; did not mutate checklist or file records.
- [x] Dashboard panel reads checklist state only and links to Shipment Monitor for action.
- [x] Existing dashboard metrics, Forecast Sales alerts, shipment tables, and document upload/download flows remain preserved.
- [x] Alert calculation does not delete, replace, or overwrite uploaded documents.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/` returns 200.
- [x] Checked `/shipment-monitor` returns 200.

## 25. 2026-05-24 SH-005 Partial Safety Record

- [x] Added closing validation using checklist status; did not change existing shipment status values.
- [x] Backend blocks closing from any update path when required docs are incomplete.
- [x] Default required checklist is seeded additively and does not overwrite uploaded files.
- [x] UI warning is advisory; API remains source of truth.
- [x] Existing upload/download/ZIP and SI flows remain unchanged.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.
- [x] Checked `/` returns 200.

## 26. 2026-05-24 SI-001 Version PDF Safety Record

- [x] Added additive PDF metadata fields to `ShippingInstructionRecord`.
- [x] New SI PDF endpoint reads from stored snapshot and does not mutate shipment records.
- [x] Existing Forecast Sales/Project SI download remains unchanged.
- [x] Existing SI revision, supersede, early approval, and cancellation behavior remains preserved.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.
- [x] Checked `/` returns 200.

## 27. 2026-05-24 SH-005 SI Blocker Safety Record

- [x] Added SI readiness check to closing validation without changing existing SI records.
- [x] Backend blocks closing if no generated/approved SI exists.
- [x] UI warning is derived from loaded SI records; API remains source of truth.
- [x] Did not alter SI PDF download, revision, supersede, cancellation, or early approval behavior.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` returns 200.
- [x] Checked `/` returns 200.

## 28. 2026-05-24 FS-017 Restricted Rough P&L Safety Record

- [x] Added additive `roughPnl` field to `ProjectItem`; did not remove or rename legacy Project/Forecast Sales fields.
- [x] Rough P&L snapshot is regenerated on Forecast Sales create/update, preserving existing offer, approval, FCO, buyer feedback, and shipment conversion flows.
- [x] Financial values are displayed only for CEO/DIRUT/ASS_DIRUT roles; non-executive users receive a restricted notice only.
- [x] Existing P&L Forecast module remains unchanged.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` returns 200.
- [x] Checked `/` returns 200.

## 29. 2026-05-24 SH-005 Payment Quality Issue Blocker Safety Record

- [x] Added additive shipment readiness fields; did not remove or rename existing shipment fields.
- [x] Closing validation extends existing document/SI blockers and does not bypass them.
- [x] Payment/commercial, quality, and issue blockers are evaluated by the backend on every completed/done/closed update path.
- [x] Shipment Monitor controls only write readiness fields; existing document upload/download/ZIP and SI flows remain unchanged.
- [x] Existing Outstanding Payment and Quality modules remain preserved; current blocker uses shipment-level readiness until stronger module links are built.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor`, and `/projects` return 200.

## 30. 2026-05-24 DOC-006 Critical Document History Safety Record

- [x] Added additive version/replacement fields to `ShipmentDocument`; did not remove existing document bytes or document group behavior.
- [x] Critical document replacement creates a new row and marks the previous same-title active critical document as `superseded`.
- [x] Superseded critical documents remain downloadable and visible as history; no destructive overwrite is performed.
- [x] Superseded critical metadata edit is blocked to preserve the historical record.
- [x] Existing required/additional document upload/download/delete/ZIP flows remain unchanged.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor`, and `/projects` return 200.

## 31. 2026-05-24 SH-004 Structured Issue Log Safety Record

- [x] Added additive `ShipmentIssueLog` model and API; did not remove existing `issueNotes`, `statusReason`, or `remarks`.
- [x] Structured issue logs are separate records and do not overwrite shipment free-text fields.
- [x] Closing validation now includes unresolved structured issues while preserving document, SI, payment, quality, and free-text issue blockers.
- [x] Issue evidence is text/link only for now, so existing document upload storage remains unchanged.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor`, and `/projects` return 200.

## 32. 2026-05-24 SCT-001 Source Change Request Safety Record

- [x] Added additive `ShipmentSourceChangeRequest` model and API; did not remove existing shipment `source` or `supplier` fields.
- [x] Source changes create separate versioned request records with old/new source, reason, evidence, impact, and approval state.
- [x] Approved request applies the new shipment source/supplier while preserving the request history.
- [x] Pending source changes block shipment closing without bypassing document, SI, payment, quality, or issue blockers.
- [x] Existing direct source field remains for compatibility; SCT-002 tracks the remaining direct-overwrite guard.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor`, and `/projects` return 200.

## 33. 2026-05-24 BCL-001 Barge Change Log Safety Record

- [x] Added additive `ShipmentBargeChangeLog` model and API; did not remove existing shipment vessel/barge/nomination fields.
- [x] Barge changes create separate versioned request records with old/new MV/TB/BG/nomination, reason, evidence, impact, and approval state.
- [x] Approved request applies the new shipment MV/TB/BG/nomination while preserving the request history.
- [x] Pending barge changes block shipment closing without bypassing document, SI, payment, quality, issue, or source change blockers.
- [x] Existing direct vessel/barge/nomination fields remain for compatibility; follow-up tracks the direct-overwrite guard.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor`, and `/projects` return 200.

## 34. 2026-05-24 Traceability Direct Overwrite Guard Safety Record

- [x] Backend blocks direct overwrite of existing source/supplier values and requires Source Change Request.
- [x] Backend blocks direct overwrite of existing vessel/barge/nomination values and requires Barge Change Log.
- [x] Empty initial values can still be filled, so legacy/imported incomplete shipments can be completed without creating false history.
- [x] Approved Source Change Request and Barge Change Log routes apply changes directly and preserve their own audit/history records.
- [x] Existing non-traceability shipment edit fields remain unchanged.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor`, and `/projects` return 200.

## 35. 2026-05-24 PAY-001 Shipment Payment Link Safety Record

- [x] Added additive payment fields only; did not remove existing Outstanding Payment fields.
- [x] Linked payment validation extends existing shipment closing blockers without bypassing document, SI, quality, issue, source, or barge blockers.
- [x] Existing Outstanding Payment list/form behavior remains compatible with unlinked legacy payment rows.
- [x] Invoice document attachment is intentionally left as a follow-up, not faked as a text-only upload.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.

## 36. 2026-05-24 QLT-001 QLT-002 Quality Workflow Safety Record

- [x] Added additive fields to `QualityResult`; old GAR/TS/Ash/TM/status fields remain preserved.
- [x] Quality workflow sections are stored as JSON text snapshots for compatibility and can be migrated later without destroying old records.
- [x] Shipment closing validation still preserves existing payment/document/SI/issue/source/barge blockers and only adds linked quality warning checks.
- [x] Existing Quality add/edit/delete flows remain available with richer fields.
- [x] Quality document attachment and dashboard alert aggregation are tracked as follow-up work.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.

## 37. 2026-05-24 PAY-002 Payment Evidence Linkage Safety Record

- [x] Added additive `invoiceDocumentId` and `paymentProofDocumentId` only; existing payment rows remain compatible.
- [x] Payment evidence reuses `ShipmentDocument` storage instead of introducing a parallel file store.
- [x] Uploads use existing file validation and shipment document download routes.
- [x] Closing validation extends linked payment checks without bypassing document, SI, quality, issue, source, or barge blockers.
- [x] Existing shipment document upload/download/ZIP behavior remains unchanged.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/outstanding-payment`, `/shipment-monitor`, and `/quality` return 200.

## 38. 2026-05-24 QLT-003 Quality Evidence Linkage Safety Record

- [x] Added additive quality evidence document id fields only; old quality records remain compatible.
- [x] Quality evidence reuses `ShipmentDocument` storage and existing allowed file validation.
- [x] QC/PSI/COA uploads require a linked shipment, preventing orphan evidence files.
- [x] Closing validation extends linked quality checks without bypassing document, SI, payment, issue, source, or barge blockers.
- [x] Existing Quality CRUD fields and shipment document upload/download/ZIP behavior remain unchanged.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/quality`, `/outstanding-payment`, and `/shipment-monitor` return 200.

## 39. 2026-05-24 DSH-001 Blocker Control Tower Safety Record

- [x] Added read-only dashboard blocker endpoint; it does not mutate shipment/payment/quality/source/barge records.
- [x] Dashboard panel is executive-only and uses existing auth-protected dashboard flow.
- [x] Existing Document Aging Alerts, Forecast Sales urgency, KPI cards, and shipment tables remain preserved.
- [x] Blocker panel links back to source modules instead of duplicating edit controls on dashboard.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/` and `/shipment-monitor` return 200.

## 40. 2026-05-24 FS-012 Structured Supplier Candidate Safety Record

- [x] Added additive `ProjectSupplierCandidate` model; did not remove legacy `supplierCandidates` text field.
- [x] Source candidate picker still appends text fallback for existing FCO/SI compatibility.
- [x] Structured candidate rows preserve source quality/stock/price snapshot and selected winner metadata.
- [x] Selecting a candidate unselects prior winners without deleting history rows.
- [x] Existing Forecast Sales create/edit, FCO, SI, summary, blending scenario, and document download flows remain preserved.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/projects` and `/` return 200.

## 41. 2026-05-24 FS-012 Selected Supplier P&L Feed Safety Record

- [x] Selected supplier winner updates rough P&L through existing Forecast Sales data instead of replacing the Forecast Sales record.
- [x] Legacy supplier candidate text, blending scenario, FCO generation, SI download, and summary download remain preserved.
- [x] Previous candidate rows remain available; only the winner flag changes.
- [x] Ran `npx tsc --noEmit`.

## 42. 2026-05-24 APR-001 SRS Approval Queue Safety Record

- [x] Added read-only `/api/approval-center/pending` aggregation endpoint; it does not create duplicate approval state.
- [x] Approval actions reuse existing Forecast Sales, Shipping Instruction, Source Change, and Barge Change endpoints.
- [x] Legacy Approval Inbox tabs for tasks, sales orders, and purchase requests remain preserved.
- [x] Queue is role-gated for Forecast Sales approvers/executive operational approvers.
- [x] Ran `npx tsc --noEmit`.

## 43. 2026-05-24 SH-003 MoM/PO Commercial Reference Safety Record

- [x] Added additive shipment reference fields only; no Forecast Sales or shipment document files are duplicated.
- [x] MoM/PO links point to existing `ProjectDocument` records and reuse existing download route.
- [x] Existing shipment document upload/download/ZIP, SI, and Forecast Sales document upload flows remain preserved.
- [x] Empty MoM/PO references remain allowed while commercial SLA rules are still being finalized.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor` and `/approval-inbox` return 200.

## 44. 2026-05-24 SCT-003 Source Confirmation Safety Record

- [x] Added additive shipment source confirmation fields; existing `source`, `supplier`, and Source Change Request records remain preserved.
- [x] Source confirmation evidence reuses `ShipmentDocument` storage and does not introduce a parallel file store.
- [x] Closing blocker only reacts to explicit non-ready/confirmed-without-evidence source confirmation states, avoiding surprise blocking of legacy rows with empty source confirmation.
- [x] Existing shipment document upload/download/ZIP, source change approval, and barge change approval flows remain preserved.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/shipment-monitor`, `/approval-inbox`, and `/projects` return 200.

## 45. 2026-05-24 AUD-001 Real Audit Logs Safety Record

- [x] Added read-only `/api/audit-logs`; it does not mutate audit rows.
- [x] Replaced demo UI data with real backend data while preserving `audit_logs` client permission gate.
- [x] Detail chips parse existing JSON safely and fall back to plain text when details are not JSON.
- [x] API is executive-gated and caps result size to prevent unbounded log reads.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/audit-logs` returns 200.

## 46. 2026-05-25 PL-001 Shipment Cost Components Safety Record

- [x] Added additive ShipmentDetail fields only: royalty, export tax/levy, survey, and payment/finance cost per MT.
- [x] Added additive PLForecast fields only: royalty, tax, survey, and payment cost per MT.
- [x] Existing buying price, sales price, freight, allowance/other cost, shipment upload/download, SI, summary, and Forecast Sales flows remain preserved.
- [x] P&L Forecast still supports legacy Google Sheets A:J rows; detailed cost headers are optional.
- [x] Shipment Monitor cost input extends the existing commercial section instead of replacing current fields.
- [x] Ran `npx prisma generate` after restarting the local Next dev server lock.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/pl-forecast`, `/shipment-monitor`, and `/projects` return 200.
- [ ] Remote Supabase migration apply is still unverified because DB host returned `P1001` from this machine.

## 47. 2026-05-25 DOM-001 Domestic Handover Safety Record

- [x] Added additive DailyDelivery fields only; no existing Daily Delivery fields were removed or renamed.
- [x] Domestic handover fields are grouped under a new Daily Delivery modal tab, preserving General, Logistics, Quality, and Commercial tabs.
- [x] Existing Daily Delivery table actions remain intact; table gained a read-only stuck-party/aging summary column.
- [x] Store mapping now preserves existing snake_case UI state while sending camelCase to the API.
- [x] API includes additive `ALTER TABLE IF NOT EXISTS` safety for handover columns.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/` and `/shipment-monitor` return 200.
- [x] Executive dashboard stuck-party aggregation is now handled through Blocker Control Tower.
- [x] Direct evidence upload/linkage exists through `DailyDeliveryDocument`.

## 48. 2026-05-25 DSH-001 Domestic Dashboard Alert Safety Record

- [x] Extended existing Blocker Control Tower instead of creating a duplicate dashboard panel.
- [x] Added read-only domestic handover alert generation from `DailyDelivery`; it does not mutate handover rows.
- [x] Existing payment, quality, source, barge, and closing blocker categories remain preserved.
- [x] Summary counts now include domestic blockers without removing old summary fields.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/` and `/shipment-monitor` return 200.

## 49. 2026-05-25 DOM-001 Domestic Evidence Upload Safety Record

- [x] Added additive `DailyDeliveryDocument` model; existing Daily Delivery rows and shipment document storage remain unchanged.
- [x] Upload route is scoped by Daily Delivery ID and does not require a shipment ID, matching domestic report reality.
- [x] Evidence upload uses the same allowed file categories requested by SRS: images, PDF, DOCX.
- [x] Evidence upload auto-links to the matching SKAB/DSR/BL/COA evidence reference field without replacing existing dates/statuses.
- [x] Existing Daily Delivery create/update/delete and table actions remain preserved.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/` and `/shipment-monitor` return 200.

## 50. 2026-05-25 DSH-001 Domestic Exact Drill-Down Safety Record

- [x] Changed only domestic blocker `href` generation; existing payment/quality/source/barge/closing blocker URLs remain preserved.
- [x] Shipment Monitor deep-link handling opens Daily Delivery without removing existing shipment `open=` modal behavior.
- [x] Daily Delivery row click/edit/delete flows remain intact; delete still stops row click propagation.
- [x] Deep-link close clears the URL without deleting or mutating Daily Delivery data.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor?main=daily`, and `/pl-forecast` return 200.

## 51. 2026-05-25 APR-001 Persistent ApprovalRequest Safety Record

- [x] Added additive `ApprovalRequest` model/table only; workflow-specific approval records remain the source of truth.
- [x] Approval Inbox still calls existing Forecast Sales, early SI, source change, and barge change approval endpoints.
- [x] Queue mirroring is additive and does not replace legacy task/sales/purchase tabs.
- [x] SLA/open-age/filter UI reads from mirrored approval metadata without blocking existing approvals.
- [x] ApprovalRequest resolution update is best-effort after the real workflow action succeeds.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor?main=daily`, `/approval-inbox`, and `/pl-forecast` return 200.

## 52. 2026-05-25 AUD-002 Critical Audit Payload Safety Record

- [x] Standardized audit payloads on high-risk mutations without changing the `AuditLog` table shape.
- [x] Forecast Sales audit still writes through existing `tryAuditLog`; only `details` payload shape changed.
- [x] SI/source/barge approval APIs still execute the same workflow decisions; audit writes remain non-blocking where they were non-blocking.
- [x] Structured `changes` arrays preserve old/new values without removing existing reason/comment fields on source records.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/approval-inbox`, `/shipment-monitor?main=daily`, and `/audit-logs` return 200.

## 53. 2026-05-25 DOC-007 Object Storage Safety Record

- [x] Added storage metadata columns additively; existing DB `data` bytes column remains for legacy and fallback files.
- [x] Upload routes default to DB storage unless Supabase Storage env vars are configured, so local testing behavior remains preserved.
- [x] Download routes first read from configured object storage when a storage key exists, otherwise read legacy DB bytes.
- [x] Shipment ZIP download reads each document from the correct backend before adding it to the archive.
- [x] Project, Shipment, and Daily Delivery document APIs keep their existing auth and role gates.
- [x] Ran `npx prisma generate`.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/`, `/shipment-monitor?main=daily`, `/projects`, and `/approval-inbox` return 200.

## 54. 2026-05-25 DOC-008 Document Drive and FS-018 Dashboard Drill-Down Safety Record

- [x] Added `/document-drive` as a new route without moving or deleting existing Project/Shipment/Daily Delivery document routes.
- [x] Document Drive uses existing secured download APIs, so files remain served through current backend access paths.
- [x] Critical Shipment documents are filtered out for non-executive roles in the aggregator API.
- [x] `staff`/document-only access was added through permissions and AppShell route guarding without removing permissions from existing roles.
- [x] Broad AppShell auto-sync and chatbot rendering are skipped for document-only users to keep the module surface limited.
- [x] Forecast Sales dashboard dropdowns read from existing `cards`/`ProjectItem` data and only open the existing detail modal; no status mutation was added.
- [x] Document Drive API now tolerates migration-partial databases where a document table is not deployed yet, instead of failing the whole aggregator.
- [x] Commercial store persist now catches localStorage quota overflow and falls back to database sync without changing business records.
- [x] Ran `npx tsc --noEmit`.
- [x] Checked `/document-drive` and `/projects` in Playwright; Document Drive list loads and Forecast Sales dashboard dropdown opens.

## 55. 2026-05-25 FS-001 Canonical Route and DOC-009 Drive Proxy Safety Record

- [x] Added `/forecast-sales` as an alias over the existing Forecast Sales page instead of moving/deleting `src/app/projects/page.tsx`.
- [x] Legacy `/projects` is redirected at middleware level, preserving query parameters.
- [x] Existing `/api/projects/*` routes are untouched because middleware only redirects exact page path `/projects`.
- [x] Internal user-facing links were updated to `/forecast-sales`; API/document links remain on their existing API paths where required.
- [x] Document Drive download proxy reads existing Project/Shipment/Daily Delivery document tables and does not mutate source records.
- [x] Critical shipment documents remain forbidden for non-executive users in the Drive proxy.
- [x] Staff/document-only access is additionally guarded at middleware level for non-Drive APIs/pages.
- [x] Ran `npx tsc --noEmit` after final edits.
- [x] Ran `git diff --check`; only existing Windows CRLF warnings were reported.
- [x] Checked `/forecast-sales` and `/document-drive` return 200.

## 56. 2026-05-25 FS-005/FS-007 FCO and Buyer Feedback History Safety Record

- [x] Added `fcoHistory` and `buyerFeedbackHistory` as additive nullable text columns; existing `fcoNumber`, `fcoGeneratedAt`, and buyer feedback fields remain unchanged.
- [x] Added a Prisma migration and an API-level `ALTER TABLE ADD COLUMN IF NOT EXISTS` guard for migration-partial environments.
- [x] FCO history is appended, not overwritten, when FCO is generated/downloaded.
- [x] Buyer feedback history is appended, not overwritten, when feedback status changes.
- [x] Forecast Sales detail UI reads history defensively; invalid/empty JSON becomes an empty list.
- [x] Ran `npx tsc --noEmit`.
- [x] `npx prisma generate` was attempted but blocked by Windows file lock on Prisma engine; rerun after stopping dev server.

## 57. 2026-05-25 FS-012 Selected Supplier Handoff Safety Record

- [x] Selected structured supplier is read from existing `supplierCandidates`; no candidate records are mutated by FCO generation.
- [x] FCO still falls back to legacy free-text supplier candidates when no selected structured supplier exists.
- [x] Shipment conversion still falls back to legacy free-text supplier candidate when no selected structured supplier exists.
- [x] Added source confirmation notes/status only during Forecast Sales Deal -> Shipment conversion and only when a selected supplier exists.
- [x] Existing supplier/source fields remain populated with the same legacy values if selected candidate data is unavailable.
- [x] Ran `npx tsc --noEmit`.

## 58. 2026-05-25 SYS-001 Production Readiness Safety Record

- [x] Added a read-only readiness endpoint; it does not mutate env, DB rows, or business records.
- [x] Added a read-only readiness page under System navigation using existing `audit_logs` executive permission.
- [x] Checks are scoped to production-critical env vars, storage provider/env, DB connectivity, expected Prisma migrations, and expected migration columns across core SRS modules.
- [x] Existing Dashboard, Forecast Sales, Shipment Monitor, Document Drive, and Audit Logs navigation remain preserved.
- [x] Ran `npx tsc --noEmit`.
- [x] Ran `npx tsc --noEmit` again after broadening critical schema checks.
- [x] Ran `npx tsc --noEmit` again after adding expected Prisma migration history verification.
- [x] Ran `git diff --check`; only existing Windows CRLF warnings were reported.

## 59. 2026-05-25 FS-019 Summary Report Safety Record

- [x] Updated only the existing Summary Report generator; SI, FCO, document download, and shipment upload routes were not touched.
- [x] Added fallback data sources without overwriting Forecast Sales or Shipment records.
- [x] Existing sample sections remain: description, specification, budget vs actual, approval, transhipment, cargo over/loss, notes, and report by.
- [x] Forecast Sales master specs, saved blending scenario, and rough P&L are read-only inputs for the PDF.
- [x] Ran `npx tsc --noEmit`.
- [x] Ran `git diff --check -- src/app/projects/page.tsx`; only existing Windows CRLF warning was reported.

## 60. 2026-05-25 FS-020 Market Price Reference Safety Record

- [x] Added read-only market reference warning to the existing Forecast Sales form.
- [x] Did not mutate Market Price, Forecast Sales, or Shipment rows from the reference card.
- [x] Historical selling price is calculated from existing shipment data only.
- [x] Save Draft and Submit Offer Profile behavior remain unchanged.
- [x] Ran `npx tsc --noEmit`.
- [x] Ran `git diff --check -- src/app/projects/page.tsx`; only existing Windows CRLF warning was reported.

## 61. 2026-05-25 PL-001 Estimated vs Actual P&L Safety Record

- [x] Added read-only reconciliation to P&L Forecast; no Forecast Sales, Shipment, or P&L records are mutated by the variance display.
- [x] Forecast Sales `rough_pnl` is used only as estimate baseline.
- [x] Existing shipment/P&L cost component rollup remains preserved.
- [x] Existing create/update/delete P&L actions remain unchanged.
- [x] Ran `npx tsc --noEmit`.
- [x] Ran `git diff --check -- src/app/pl-forecast/client.tsx`; only existing Windows CRLF warning was reported.

## 62. 2026-05-25 Public Drive and Forecast Dashboard Safety Record

- [x] Forecast Sales dashboard layout changed only in summary card presentation; dashboard data/status logic was not changed.
- [x] Document Drive public access is read-only and scoped to `/document-drive` plus `/api/document-drive/*`.
- [x] Logged-out users still cannot access other modules through middleware.
- [x] Critical shipment documents remain hidden/blocked for public and non-executive users.
- [x] Generated SI appears in Document Drive as a virtual PDF and does not become an uploaded document row.
- [x] Document Drive listing no longer mutates schema or fetches file bytes during list load.
- [x] Ran `npx tsc --noEmit`.
