# Module Requirements

Dokumen ini merinci kebutuhan tiap modul berdasarkan dokumen revisi full dan simple.

## 1. Dashboard

### Purpose

Dashboard adalah control tower untuk management dan tim operasional. Dashboard tidak cukup hanya angka summary. Dashboard harus menunjukkan blocker dan alert.

### Main Widgets

1. Forecast Sales Funnel
   - Draft offer.
   - Submitted/CEO review.
   - Approved.
   - FCO sent.
   - Waiting buyer feedback.
   - Negotiation/pending.
   - Deal.
   - Failed.
   - Failed reason summary.
   - Estimated revenue and margin for CEO/management only.

2. Shipment by Status
   - Draft
   - Waiting Source
   - Loading
   - Discharging
   - Waiting Payment
   - Closed
   - Issue/Hold

3. Export vs Domestic Count
   - Jumlah shipment export.
   - Jumlah shipment domestic.
   - Filter per month/year/status.

4. Source Pending
   - Waiting source confirmation.
   - Legal pending.
   - Cargo not ready.
   - Source change waiting approval.

5. Quality Warning
   - Waiting QC.
   - Waiting PSI.
   - Waiting COA POL.
   - Waiting COA POD.
   - Warning.
   - Claim potential.

6. Document Aging
   - Required docs pending.
   - Docs overdue by aging rule.
   - Domestic handover stuck by party.

7. Revision Activity
   - Forecast Sales price/laycan revisions.
   - FCO revisions.
   - Source changes.
   - Barge changes.
   - SI revisions/cancellations.

8. Approval Queue
   - Offer profile approval.
   - FCO approval/revision.
   - Early SI.
   - SI revision.
   - Source change.
   - FCO approval.

9. Shipment Data Completeness
   - Low completeness shipment.
   - Missing mandatory fields.
   - Placeholder/default data warning.

10. Payment Outstanding
   - Due soon.
   - Overdue.
   - Dispute.
   - Received payment pending confirmation.

11. Open Issues
   - Issue category.
   - PIC.
   - Action plan.
   - Target date.

12. P&L Summary
   - Estimated margin.
   - Actual margin.
   - Margin/MT.
   - Cost deviation.

### Dashboard Rules

- Semua card alert harus clickable ke module/entity terkait.
- Role access harus diterapkan.
- Dashboard harus menampilkan blocker, bukan hanya total angka.
- Alert aging harus dihitung otomatis dari tanggal dokumen/status.

## 2. Partners & Directory

### Purpose

Master data untuk pihak eksternal dan internal agar tidak double input manual.

### Master Data Types

- buyer,
- supplier,
- source,
- IUP OP/legal source,
- surveyor,
- lab,
- agent POL,
- agent POD,
- barge owner,
- vessel owner,
- bank,
- vendor,
- internal PIC.

### Requirements

- Data master harus bisa dipakai sebagai dropdown/search di Forecast Sales, Sales, Shipment, Source, Quality, Payment, Freight.
- Duplicate detection minimal berdasarkan name/type.
- Data dapat memiliki status active/inactive.
- Legal/critical party dapat punya dokumen dan expiry date.

## 3. Market Price

### Purpose

Reference price engine untuk Sales Offer dan P&L.

### Data

- ICI 1 sampai ICI 5,
- NEWC,
- HBA/HPB,
- MGO,
- FX rate,
- freight indicator,
- source/reference,
- updated at,
- updated by,
- daily history.

### Integration

- Sales Offer harus dapat melihat latest market price.
- P&L dapat memakai market reference untuk deviation analysis.
- Dashboard dapat menampilkan price warning.

## 4. Forecast Sales

### Purpose

Forecast Sales menggantikan modul lama Projects sebagai tempat trader membuat rencana penjualan, offer profile, supplier candidate comparison, FCO, buyer feedback, dan deal conversion sebelum shipment.

### Main Sections

1. Management Dashboard
2. Forecast / Offer Draft
3. Market Price Reference
4. Historical Selling Price
5. Product and Coal Specification
6. Supplier Candidate
7. Embedded Blending Simulation
8. Restricted Rough P&L
9. CEO Approval
10. FCO Generator
11. Buyer Feedback
12. Conversion to Shipment
13. Revision Log

### Management Dashboard

Metric minimal:

- total forecast this month,
- total draft offer,
- total submitted/CEO review,
- total approved offer,
- total FCO sent,
- total deal,
- total failed,
- pending buyer feedback,
- estimated revenue,
- estimated margin/P&L restricted for CEO/management.

Rules:

- Revenue and margin restricted mengikuti role.
- Card dapat diklik menuju filtered records.
- Filter minimal by month, trader, buyer, status.

### Forecast / Offer Data

Data minimal:

- Forecast Sales ID,
- forecast month,
- offer/project name,
- trader name auto from user,
- buyer name,
- buyer country,
- commodity/product,
- quantity,
- laycan/delivery window,
- port of loading,
- sales term: FOB, CIF, CNF/CFR, FAS, or custom,
- target selling price,
- price basis: Fixed, ICI, NEWC/Newcastle, HBA/HPB, formula, or custom,
- payment term,
- surveyor,
- internal notes.

Rules:

- Draft dapat disimpan incomplete.
- Submit Offer Profile wajib semua mandatory field lengkap.
- Trader hanya dapat submit draft miliknya atau record yang ia punya permission.

### Market and Historical Price Reference

Forecast Sales harus menampilkan:

- latest ICI 1 sampai ICI 5,
- latest NEWC/Newcastle,
- latest HBA/HPB,
- historical selling price by similar buyer/product/spec/source if available,
- warning jika target selling price terlalu rendah dari reference.

### Product and Coal Specification

Field minimal:

- GAR/GCV,
- NAR if used,
- TM,
- IM,
- TS,
- Ash,
- VM,
- HGI,
- Size,
- analysis method,
- tolerance/lowest limit where applicable.

### Supplier Candidate

Trader dapat menambahkan beberapa source/supplier candidate dari Source module.

Candidate data minimal:

- source/supplier,
- origin/location,
- stock/COB and stockpile detail,
- supplier price/FOB barge price,
- readiness status,
- GAR/GCV,
- TM,
- TS,
- Ash,
- VM,
- HGI,
- Size,
- notes.

Rules:

- Sistem membandingkan requested spec dengan candidate spec.
- Sistem memberi warning jika candidate di bawah requested spec.
- Lanjut dengan candidate di bawah spec wajib reason/acknowledgment.
- Candidate terpilih menjadi selected supplier/source untuk offer dan shipment.

### Embedded Blending Simulation

Forecast Sales harus menyediakan blending simulation di dalam offer input.

Input:

- selected candidates,
- quantity split,
- GAR/GCV,
- TM,
- TS,
- Ash,
- VM if available,
- price/cost per MT.

Output:

- final estimated GAR/GCV,
- final estimated TM,
- final estimated TS,
- final estimated Ash,
- final estimated VM,
- average supplier cost,
- estimated blended cost,
- pass/warning/not recommended.

Rules:

- Hasil blending dapat disimpan sebagai reference offer.
- Hasil blending tidak menggantikan QC/PSI/COA final.

### Restricted Rough P&L

Rough P&L dibuat otomatis setelah Submit Offer Profile.

Data minimal:

- selling price,
- supplier price,
- quantity,
- supplier/blending cost,
- freight estimate,
- surveyor cost,
- royalty/tax/export cost if applicable,
- other cost,
- revenue,
- total cost,
- estimated gross profit,
- margin/MT,
- margin percentage.

Rules:

- Hanya CEO, DIRUT, ASS_DIRUT, COO, atau role management tertentu yang bisa melihat.
- Trader umum tidak bisa melihat value restricted.
- Perubahan price, quantity, supplier, cost, atau freight membuat recalculation and revision log.

### Approval and FCO Flow

Status minimal:

- Draft,
- Submitted to CEO,
- CEO Review,
- Revision Requested,
- Approved,
- Rejected,
- FCO Sent,
- Waiting Buyer Feedback,
- Negotiation/Pending,
- Deal,
- Failed,
- Converted to Shipment.

Rules:

- FCO tidak bisa download/generate sebelum Approved.
- Approval/rejection/revision request wajib comment.
- FCO number auto generated and unique.
- FCO revision membuat version baru.
- Failed wajib reason dan notifikasi ke CEO/management.
- Deal dapat convert ke Shipment.

### FCO Generator

FCO PDF harus mengikuti contoh `FCO.C2604 (1).pdf`.

Komponen minimal:

- FULL CORPORATE OFFER title,
- date,
- to/buyer,
- attention,
- FCO number,
- declaration statement,
- commodity,
- coal quality table,
- origin,
- quantity and tolerance,
- laycan,
- port of loading,
- base price,
- price adjustment formula,
- shipping terms,
- loading rate and laytime clauses,
- payment terms,
- independent surveyor,
- other terms,
- validity,
- signature block.

Rules:

- Clause/template dapat berbeda berdasarkan sales term.
- FOB template dapat default loading rate 8,000 MT geared/grabbed or 10,000 MT gearless PWWD SHINC, dapat diubah oleh authorized user.
- Generated PDF harus mencatat generated by, generated at, version, and source Forecast Sales.

## 5. Sales Monitor

### Purpose

Sales Monitor menjadi monitoring layer untuk funnel dan aktivitas sales. Forecast creation, offer profile, FCO, dan buyer feedback utama berada di Forecast Sales.

### Data

- forecast month,
- buyer,
- Forecast Sales ID,
- FCO no.,
- MoM/PO if already available,
- quantity,
- price,
- laycan,
- shipping term,
- payment term,
- approval status,
- buyer feedback,
- deal status.

### Rules

- Sales Monitor dapat menampilkan data dari Forecast Sales.
- Sales Monitor tidak boleh menjadi sumber upload FCO/SI utama jika Forecast Sales dan Shipment Monitor sudah menjadi owner.
- Deal confirmed/Deal membuat shipment link melalui Forecast Sales.

## 6. Shipment Monitor

### Purpose

Main operational control center.

### Required Sub-Tabs

1. Shipment Header
2. Commercial Reference
3. Source Result
4. Source Change Traceability
5. Quality Data
6. Shipping Instruction
7. Vessel / Barge Nomination
8. Barge Change Log
9. POL Timeline
10. POD Timeline
11. Document Checklist
12. Payment Tracking
13. Issue Log
14. Closing Checklist

### Shipment Data Completeness

Shipment Monitor harus menampilkan completion percentage per shipment.

Rules:

- Completion dihitung dari mandatory fields per status/type.
- Nilai kosong, `-`, `0` yang tidak valid, `N/A`, atau default dummy tidak dihitung sebagai complete.
- User dapat membuka missing field list dari score.
- Score dipakai sebagai monitoring quality data, sedangkan closing tetap diputuskan oleh closing checklist validation.
- Data yang berasal dari Forecast Sales harus ikut dihitung sebagai complete jika valid dan linked.

#### 6.1 Shipment Header

Fields:

- Shipment ID,
- export/domestic type,
- buyer,
- Forecast Sales reference,
- product,
- qty plan,
- POL,
- POD,
- laycan,
- shipment status,
- PIC.

Rules:

- Created from Forecast Sales Deal.
- Editable by Sales/Traffic.
- Critical field changes audited.

#### 6.2 Commercial Reference

Fields:

- FCO/MoM/PO reference,
- buyer contract,
- supplier contract reference,
- shipping term,
- price,
- invoice amount,
- payment term,
- bank info.

Rules:

- Link to Forecast Sales/Sales documents.
- Should feed Payment and P&L.

#### 6.3 Source Result

Fields:

- source,
- supplier,
- legal status,
- cargo readiness,
- stock/COB,
- jetty,
- hauling status.

Rules:

- Source Team owns input.
- Sales/Traffic can view and monitor.

#### 6.4 Source Change Traceability

Fields:

- old source,
- new source,
- reason,
- evidence,
- impact,
- CEO approval,
- new source contract status,
- active version.

Rules:

- No overwrite.
- New source active only after approval rule.

#### 6.5 Quality Data

Fields:

- source quality,
- QC,
- PSI,
- COA POL,
- COA POD,
- comparison,
- warning.

Rules:

- Quality Team owns input.
- Missing/Warning blocks closing.

#### 6.6 Shipping Instruction

Fields:

- SI no.,
- SI version,
- issue date,
- laycan first day,
- PDF,
- approval status,
- revision history.

Rules:

- H-10 rule.
- Early/revision requires CEO approval.
- Old version remains.

#### 6.7 Vessel / Barge Nomination

Fields:

- MV,
- TB/BG,
- barge owner,
- vessel TA,
- stowage plan,
- agent POL,
- agent POD.

Rules:

- Domestic final TB/BG owner is Sales/Traffic.
- Change must create Barge Change Log.

#### 6.8 Barge Change Log

Fields:

- old TB/BG,
- new TB/BG,
- date/time,
- changed by,
- reason,
- evidence,
- active version.

Rules:

- No overwrite.
- Notify Source/Quality if impact exists.

#### 6.9 POL Timeline

Fields:

- arrive POL,
- NOR POL,
- berthing,
- commence loading,
- complete loading,
- BL date,
- PEB,
- LHV.

Rules:

- Shipment status should move based on milestone dates.

#### 6.10 POD Timeline

Fields:

- ETA POD,
- arrive POD,
- NOR POD,
- in position,
- discharge start,
- discharge complete,
- factory date.

Rules:

- Late POD days calculated automatically.

#### 6.11 Document Checklist

Fields:

- document name,
- status,
- received date,
- submitted date,
- submitted to,
- aging,
- upload file,
- notes.

Rules:

- Mandatory docs block closing if missing.

#### 6.12 Payment Tracking

Fields:

- invoice amount,
- submit docs date,
- due date,
- received payment,
- overdue days,
- payment status.

Rules:

- Overdue alert if due date passed and payment not received.

#### 6.13 Issue Log

Fields:

- issue category,
- description,
- impact,
- action plan,
- target date,
- status,
- evidence.

Rules:

- Issue/Hold/Cancelled requires reason.

#### 6.14 Closing Checklist

Fields:

- final qty,
- docs complete,
- quality final,
- payment status,
- issue closed/reasoned,
- SI/revision status.

Rules:

- Cannot close if mandatory data incomplete.

## 7. Source Module

### Purpose

Source/supplier and cargo readiness workflow.

### Flow

1. Receive source request from Shipment Monitor.
2. Confirm source and supplier.
3. Check legal source.
4. Check jetty/loading port.
5. Check cargo readiness.
6. Submit source result.
7. If source changes, use Source Change Traceability.

### Required Fields

- Shipment ID,
- buyer,
- product,
- qty,
- laycan,
- POL/POD requirement,
- origin,
- area,
- source,
- supplier,
- IUP OP,
- shipment flow,
- RKAB,
- kuota export,
- source contract,
- legal status,
- jetty,
- loading slot,
- stock ready,
- COB,
- hauling readiness,
- readiness date,
- issue,
- remarks,
- evidence upload.

## 8. Quality Module

### Purpose

Quality control workflow linked to shipment/Forecast Sales.

### Sections

1. Contract Spec
2. Source Quality Estimate
3. QC Result
4. PSI Result
5. COA POL
6. COA POD
7. Quality Comparison

### Output

- Passed
- Warning
- Need Review
- Claim Potential
- Rejected

## 9. Blending Simulation

### Purpose

Simulation for offer/source decisions.

### Data

- source A/B/C,
- quantity,
- GAR,
- TS,
- Ash,
- TM,
- cost/MT,
- final blended quality,
- average cost,
- estimated margin,
- pass/warning/not recommended.

### Integration

- Sales can use before offer.
- Source can use for source strategy.
- Quality can review quality feasibility.

## 10. Transshipment / Freight

### Purpose

Freight, barging, laytime, demurrage, and logistics cost control.

### Data

- freight price,
- allowance,
- demurrage/despatch,
- SPAL,
- SI,
- sent to supplier,
- sent to barge owner,
- PBM,
- PNBP/STS,
- laytime calculation.

### Integration

- Link to Shipment.
- Feed P&L.
- Upload Freight/Cost docs.

## 11. Outstanding Payment

### Purpose

Buyer and vendor payment monitoring.

### Buyer Payment Data

- invoice amount,
- invoice price,
- payment term,
- due date,
- submit docs to bank/buyer,
- received payment date,
- overdue days,
- payment status,
- dispute amount.

### Vendor Payment Data

- invoice receive,
- submit system,
- approval DT/RH,
- submit finance,
- paid date,
- paid to vendor,
- aging.

## 12. P&L

### Purpose

Estimated and actual margin monitoring.

### Data Sources

- selling price from Sales/Shipment,
- supplier price from Source/Shipment,
- freight from Transshipment/Freight,
- barging cost,
- PBM,
- PNBP,
- final quantity,
- invoice amount,
- expenses.

### Output

- estimated margin,
- actual margin,
- margin/MT,
- total margin,
- deviation.

## 13. Expenses

### Purpose

Other cost tracking.

### Data

- expense type,
- related shipment/Forecast Sales flag,
- vendor,
- date,
- amount,
- approval,
- notes.

## 14. Tasks

### Purpose

Follow-up action tracker linked to Forecast Sales/shipment/issue/docs/payment.

### Data

- task name,
- linked module,
- linked Forecast Sales/shipment,
- assigned to,
- due date,
- status,
- reminder,
- notes.

## 15. Meeting

### Purpose

Meeting notes and action plan.

### Data

- meeting title,
- date,
- attendees,
- linked Forecast Sales/shipment,
- summary,
- action points,
- PIC,
- due date.

### Rule

Action point can create Task.

## 16. AI Excel Agent

### Purpose

Supporting tool for historical Excel import, comparison, missing data detection, and summary generation.

### Rule

AI Excel Agent is not the main workflow. It supports migration and analysis only.
