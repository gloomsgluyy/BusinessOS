# Implementation Roadmap and Acceptance

Dokumen ini memecah SRS menjadi phase implementasi.

## Phase 1 - Core Workflow and Shipment Foundation

Priority: Very High

### P1-01 Forecast Sales Foundation and Shipment Conversion

Scope:

- Rename Projects product-facing module to Forecast Sales.
- Trader can create Forecast Sales draft.
- Mandatory offer fields are validated before Submit Offer Profile.
- CEO approval flow exists before FCO generation.
- Deal creates Shipment.
- Shipment ID generated.
- Forecast Sales stores linked shipment.
- Forecast Sales fields populate shipment header.

Expected Output:

- Forecast Sales replaces Projects in user-facing workflow.
- One-click or automatic Convert to Shipment.
- No duplicate manual input for basic shipment data.

Acceptance Test:

1. Create Forecast Sales draft.
2. Try submit with missing mandatory fields and verify blocked.
3. Complete mandatory fields and submit to CEO.
4. Approve as CEO/management.
5. Mark buyer feedback as Deal.
6. Convert to Shipment.
7. Verify Shipment ID exists.
8. Verify buyer, commodity, qty, laycan, POL, sales price, payment, surveyor, supplier/source, and PIC copied.
9. Verify Forecast Sales linked shipment ID.

### P1-01A FCO Generator and Buyer Feedback

Scope:

- FCO number auto generated.
- FCO PDF template based on provided sample.
- FCO download blocked before approval.
- FCO sent to buyer status.
- Buyer feedback status: waiting, negotiation/pending, deal, failed.
- Failed reason and CEO notification.

Expected Output:

- Approved Forecast Sales can generate FCO.
- FCO sent and buyer result are traceable.

Acceptance Test:

1. Create approved Forecast Sales.
2. Generate FCO PDF.
3. Verify FCO number is unique.
4. Verify unapproved Forecast Sales cannot download FCO.
5. Mark FCO sent.
6. Set Failed without reason and verify blocked.
7. Set Failed with reason and verify CEO alert.
8. Set Deal and verify shipment conversion becomes available.

### P1-02 Revise Shipment Monitor into Sub-Tabs

Scope:

- Header
- Commercial
- Source Result
- Quality
- SI
- Nomination
- Timelines
- Documents
- Payment
- Issue
- Closing
- Data completeness score

Expected Output:

- Shipment Monitor no longer operates as one long Excel-like table.

Acceptance Test:

1. Open shipment detail.
2. Verify sub-tab/section exists.
3. Verify each section has owner and relevant fields.
4. Verify table summary remains readable.
5. Verify completion percentage and missing fields are visible.

### P1-03 Add Barge Change Log

Scope:

- old TB/BG,
- new TB/BG,
- reason,
- evidence,
- changed by,
- timestamp,
- status,
- active version.

Expected Output:

- Nomination changes are traceable.

Acceptance Test:

1. Change TB/BG.
2. Verify old value remains in history.
3. Verify new value active.
4. Verify reason required.
5. Verify evidence can be uploaded.

### P1-04 Add Document Checklist with Aging

Scope:

- document status,
- owner,
- required flag,
- received date,
- submitted date,
- submitted to,
- aging,
- upload.

Expected Output:

- Documents are trackable and blockers visible.

Acceptance Test:

1. Add required document.
2. Leave status Pending past threshold.
3. Verify aging.
4. Verify dashboard alert.
5. Verify closing blocked.

### P1-05 Role Ownership

Scope:

- Sales/Traffic, Source, Quality, CEO, Admin/Finance.
- View/edit separation.

Expected Output:

- Teams edit only owned sections.

Acceptance Test:

1. Login as Source Team.
2. Verify can edit source data.
3. Verify cannot own final domestic TB/BG.
4. Login as Quality.
5. Verify can edit quality only.

## Phase 2 - Traceability and Quality Control

Priority: High to Very High

### P2-01 Shipping Instruction Management

Scope:

- SI per shipment,
- PDF generation,
- SI versioning,
- H-10 rule,
- early SI approval,
- revision approval,
- cancellation history.

Expected Output:

- SI is controlled and traceable.

Acceptance Test:

1. Create shipment with laycan.
2. Try issue SI before H-10.
3. Verify approval required.
4. Approve and generate PDF.
5. Revise shipment data.
6. Create SI revision.
7. Verify V2 exists and V1 remains.

### P2-02 Source Change Traceability

Scope:

- old source,
- new source,
- reason,
- evidence,
- impact,
- CEO approval,
- contract status,
- active version.

Expected Output:

- Source changes cannot overwrite previous source.

Acceptance Test:

1. Request source change.
2. Verify old source remains.
3. Verify new source pending approval.
4. Approve.
5. Verify new source active.
6. Verify dashboard shows pending before approval.

### P2-03 Quality Workflow and Comparison

Scope:

- Contract spec,
- source quality,
- QC,
- PSI,
- COA POL,
- COA POD,
- comparison,
- warning.

Expected Output:

- Quality risk is visible and blocks closing when unresolved.

Acceptance Test:

1. Input contract spec.
2. Input QC/PSI/COA values outside tolerance.
3. Verify warning.
4. Try close shipment.
5. Verify blocked until reviewed.

### P2-04 Domestic Document Handover

Scope:

- SKAB,
- DSR,
- BL/CM,
- COA,
- finance handover,
- approval DT,
- paid to vendor,
- aging per party.

Expected Output:

- Domestic docs stuck point is visible.

Acceptance Test:

1. Create domestic shipment.
2. Add SKAB flow dates.
3. Leave Traffic to Finance empty.
4. Verify aging and alert.

## Phase 3 - Control Tower, Approval, and Finance Integration

Priority: Medium to High

### P3-01 Dashboard Alerts

Scope:

- source pending,
- quality warning,
- docs aging,
- payment overdue,
- open issue,
- SI approval,
- revision activities,
- P&L summary.

Acceptance Test:

1. Create pending source.
2. Create quality warning.
3. Create overdue payment.
4. Verify all appear in dashboard.
5. Click alert and verify navigation.

### P3-02 Approval Center

Scope:

- FCO,
- early SI,
- SI revision,
- source change,
- optional barge change.

Acceptance Test:

1. Trigger early SI.
2. Verify approval queue.
3. Approve as CEO.
4. Verify entity status changes.
5. Verify approval history.

### P3-03 Payment, Freight, and P&L Integration

Scope:

- Outstanding Payment linked to shipment.
- Freight linked to shipment.
- Expenses linked to shipment/Forecast Sales.
- P&L pulls data from modules.

Acceptance Test:

1. Add shipment selling/buying price.
2. Add freight and PBM cost.
3. Add payment invoice.
4. Verify P&L calculated.
5. Change final qty.
6. Verify actual margin changes.

## Phase 4 - Automation, Hardening, and Historical Support

Priority: Medium

### P4-01 P&L Automation Improvement

Scope:

- estimated vs actual P&L,
- cost deviation,
- margin/MT,
- restricted view.

Acceptance Test:

1. Compare planned and actual values.
2. Verify deviation.
3. Verify restricted role cannot view sensitive details.

### P4-02 AI Excel Agent Enhancement

Scope:

- historical Excel import,
- missing field detection,
- compare old Excel to system data,
- summary report.

Acceptance Test:

1. Upload/import historical Excel.
2. Verify missing data detection.
3. Verify summary report generated.

## Global Acceptance Criteria

Sistem revisi dianggap acceptable jika:

1. End-to-end flow from deal to closing works.
2. Forecast Sales replaces Projects as product-facing forecast/offer/FCO module.
3. FCO cannot be generated/downloaded before required approval.
4. Shipment Monitor is workflow-based and shows data completeness.
5. Source, Quality, Sales/Traffic ownership is enforced.
6. Source change, barge change, price/laycan revision, FCO revision, and SI revision have no overwrite.
7. Documents have status, date, aging, owner, upload.
8. Domestic document handover is traceable.
9. Quality comparison can create warning.
10. Closing validation prevents incomplete close.
11. Dashboard shows blockers.
12. Approval and audit trail exist for critical actions.
