# SRS Master - CoalTrade OS Revision

## 1. Purpose

CoalTrade OS harus menjadi sistem workflow end-to-end untuk proses trading batubara, dari peluang/deal sampai closing shipment dan P&L. Sistem harus mengurangi kebutuhan tracking manual di Excel, mencegah dokumen hilang, membuat perubahan source/tongkang/SI traceable, dan memberikan dashboard kontrol operasional yang jelas.

Dokumen ini menjadi acuan finalisasi production-grade berdasarkan 3 dokumen revisi yang diberikan.

## 2. Product Vision

CoalTrade OS adalah operating system internal untuk mengontrol:

- market price dan pricing reference,
- Forecast Sales, offer profile, FCO, buyer feedback, dan deal confirmation,
- project/deal master legacy sebagai Forecast Sales parent,
- shipment execution,
- source/supplier readiness,
- source change traceability,
- quality workflow dan quality comparison,
- Shipping Instruction per shipment,
- vessel/barge nomination dan barge change log,
- document checklist dan document aging,
- domestic document handover,
- payment outstanding,
- freight/transshipment cost,
- expenses,
- estimated vs actual P&L,
- dashboard alert,
- approval center,
- audit trail.

## 3. System Scope

### 3.1 In Scope

Sistem harus mencakup modul:

1. Dashboard
2. Partners & Directory
3. Market Price
4. Forecast Sales
5. Sales Monitor
6. Shipment Monitor
7. Source
8. Source Change Traceability
9. Quality
10. Blending Simulation
11. Shipping Instruction Management
12. Barge Change Log
13. Document Checklist with Aging
14. Domestic Document Handover
15. Transshipment / Freight
16. Outstanding Payment
17. P&L
18. Expenses
19. Tasks
20. Meeting
21. Approval Center
22. Audit Trail
23. AI Excel Agent as supporting tool

### 3.2 Out of Scope for This SRS

Hal berikut tidak menjadi fokus utama SRS ini, kecuali dibutuhkan untuk mendukung workflow:

- integrasi akuntansi eksternal penuh,
- bank API reconciliation otomatis,
- OCR dokumen legal tingkat lanjut,
- e-signature formal,
- full vessel tracking AIS,
- public customer portal.

## 4. Core Principles

### CP-01 Workflow, Not Spreadsheet

Sistem tidak boleh hanya menampilkan data sebagai tabel Excel panjang. Modul besar seperti Shipment Monitor harus dibagi ke sub-tab atau section workflow yang jelas.

### CP-02 Module Ownership

Dokumen dan data harus diinput di modul yang memiliki proses tersebut. Contoh:

- commercial docs di Forecast Sales/Sales Monitor,
- source/legal docs di Source,
- quality docs di Quality,
- operational shipment docs di Shipment Monitor,
- payment docs di Outstanding Payment,
- freight/cost docs di Transshipment/Freight.

### CP-03 No Overwrite for Revisions

Perubahan berikut tidak boleh overwrite data lama:

- source/supplier change,
- TB/BG/MV nomination change,
- SI revision/cancellation,
- Forecast Sales price/laycan revision,
- FCO revision/cancellation,
- critical document replacement.

Sistem wajib menyimpan old value, new value, reason, evidence, user, timestamp, status, dan active version.

### CP-04 Closing Must Be Controlled

Shipment tidak boleh closed jika:

- mandatory documents belum lengkap,
- final quantity belum ada,
- mandatory quality data belum ada,
- quality warning belum reviewed,
- payment status belum sesuai rule,
- SI/revision status belum clear,
- issue/hold/cancelled reason belum lengkap.

### CP-05 Dashboard Must Show Blockers

Dashboard harus berfungsi sebagai control tower berbasis alert:

- source pending,
- quality warning,
- document aging,
- payment overdue,
- open issue,
- SI approval queue,
- source/barge/SI revision activity,
- P&L deviation.

## 5. User Roles

### 5.1 Sales / Traffic Team

Sales dan Traffic diperlakukan sebagai satu role operasional-komersial. Role ini menjadi owner:

- sales forecast,
- buyer/Forecast Sales/deal,
- Forecast Sales, offer profile, FCO, buyer feedback,
- shipment header,
- final MV/TB/BG nomination,
- SI creation/revision request,
- POL/POD timeline,
- operational shipment documents,
- payment monitoring,
- issue log,
- shipment closing.

Tidak menjadi owner:

- legal source detail,
- QC/PSI/COA result,
- final quality comparison.

### 5.2 Source Team

Owner:

- source,
- supplier,
- IUP OP,
- RKAB,
- kuota export,
- jetty/loading readiness,
- stock/COB,
- hauling,
- cargo readiness,
- source issue,
- source change request and evidence.

Rule khusus domestic:

Source Team hanya sampai sourcing/source confirmation. Source Team tidak memiliki final TB/BG nomination untuk domestic. Final nomination dan perubahan tongkang dimiliki Sales / Traffic Team.

### 5.3 Quality Team

Owner:

- contract spec review,
- source quality verification,
- QC result,
- PSI result,
- COA POL,
- COA POD,
- quality comparison,
- quality warning,
- claim potential.

Quality data wajib link ke Forecast Sales/shipment.

### 5.4 CEO / Management

Owner approval dan review:

- FCO approval jika diperlukan,
- early SI before H-10,
- SI revision/cancellation,
- source change approval,
- high-risk issue acknowledgment,
- restricted P&L review,
- approval queue monitoring.

### 5.5 Admin / Finance

Owner support:

- master data,
- payment received,
- vendor payment,
- expenses,
- P&L support,
- data cleaning/import support.

## 6. End-to-End Flow

### Flow E2E-01 Market Reference

Market Price diperbarui untuk ICI, NEWC, HBA/HPB, MGO, FX rate, freight indicator, dan historical trend. Data ini menjadi referensi Sales Offer dan P&L.

### Flow E2E-02 Forecast Sales and Offer

Sales / Traffic membuat Forecast Sales sebagai rencana penjualan/offer awal. Trader dapat menyimpan draft yang belum lengkap, lalu melengkapi buyer, buyer country, commodity, quantity, laycan/delivery window, port of loading, sales term, target selling price, price basis, payment term, surveyor, supplier candidate, coal specification, internal notes, dan market price reference. Saat offer profile lengkap, trader submit ke CEO/management untuk approval. Setelah approved, sistem dapat generate FCO dan mencatat buyer feedback sampai status Deal, Pending/Negotiation, atau Failed.

### Flow E2E-03 Shipment Creation

Deal confirmed dari Forecast Sales harus menghasilkan Shipment ID. Data buyer, commodity, quantity, cargo specification, delivery window, POL, sales price, payment term, surveyor, selected supplier/source, dan PIC trader otomatis terbawa ke Shipment Monitor. Shipment awal berstatus Upcoming/Draft Shipment atau Waiting Source Confirmation. Sales / Traffic melengkapi shipment header.

### Flow E2E-04 Source Confirmation

Source Team menerima request dari shipment, mengisi source/supplier/legal/cargo readiness. Output: Source Submitted, Cargo Ready, Partial Ready, Not Ready, atau Legal Pending.

### Flow E2E-05 Quality Validation

Quality Team mengisi QC, PSI, COA POL, COA POD, dan membandingkan dengan contract spec. Output: Passed, Warning, Need Review, Claim Potential, atau Rejected.

### Flow E2E-06 SI Management

Sales / Traffic generate SI per shipment. Normal issue hanya boleh H-10 dari first laycan. Early SI dan SI revision wajib approval/acknowledgment CEO.

### Flow E2E-07 Shipment Execution

Sales / Traffic mengontrol MV/TB/BG nomination, POL timeline, loading, BL, document processing, sailing, POD, discharge, final quantity, issue log.

### Flow E2E-08 Documents

Dokumen harus dikelola berdasarkan owner module dan link ke shipment. Shipment Document Checklist menampilkan status, tanggal, aging, upload, dan blocker.

### Flow E2E-09 Payment and P&L

Outstanding Payment memantau invoice, due date, received payment, overdue, dispute, vendor payment. P&L menarik selling price, supplier price, freight, barging, PBM, PNBP, final quantity, expenses.

### Flow E2E-10 Closing

Shipment close hanya jika mandatory docs, final qty, quality, payment, SI, issue, dan required approvals sudah clear.

## 7. High-Level Data Objects

### Forecast Sales

Forecast Sales ID, forecast month, offer/project name, trader, buyer, buyer country, commodity, quantity, laycan/delivery window, POL/POD if known, sales term, target selling price, price basis, payment term, surveyor, supplier candidates, requested coal spec, market reference, historical selling price reference, offer status, FCO number, buyer feedback status, failed reason, linked shipment.

Note: semua referensi lama bernama Project pada code/database harus dimigrasikan secara bertahap ke istilah Forecast Sales. Untuk backward compatibility, field Project dapat tetap ada secara teknis, tetapi label produk dan SRS memakai Forecast Sales.

### Shipment

Shipment ID, type export/domestic, buyer, Forecast Sales reference, product, qty plan, source, supplier, POL/POD, laycan, status, PIC, commercial reference, quality status, document status, payment status, closing status.

### Source

Source ID, supplier, origin, IUP OP, RKAB, kuota export, jetty, stock/COB, hauling status, readiness date, legal status, source issue.

### Quality

Contract spec, source estimate, QC result, PSI result, COA POL, COA POD, quality comparison, warning, claim potential.

### Shipping Instruction

SI number, version, shipment ID, Forecast Sales ID, buyer, supplier, source, POL/POD, laycan, product, spec, quantity, vessel/barge, contract reference, document required, remarks, approval status, PDF.

### FCO

FCO number, FCO version, Forecast Sales ID, approval status, buyer, attention, commodity, coal quality table, origin, quantity, laycan, port of loading, base price, price adjustment formula, shipping terms, loading rate clauses, payment terms, independent surveyor, other terms, validity, generated PDF, sent date, buyer feedback, failed reason if any.

### Document

Document name, category, required flag, owner, status, received date, submitted date, submitted to, aging days, upload file, hardcopy status, notes.

### Revision Log

Entity type, entity ID, old value, new value, reason category, reason detail, evidence, requested by, approved by, approval status, timestamp, active version.

## 8. Success Criteria

Sistem dianggap memenuhi SRS jika:

1. Deal confirmed dapat membuat shipment.
2. Forecast Sales menggantikan label Projects sebagai modul forecast/offer/FCO.
3. FCO hanya dapat digenerate/didownload setelah approval yang dibutuhkan.
4. Shipment Monitor tidak lagi berupa satu tabel panjang, tetapi workflow/sub-tab.
5. Source Team scope jelas, terutama domestic.
6. Source change, barge change, price/laycan revision, FCO revision, dan SI revision memiliki history.
7. SI bisa generate per shipment dan punya H-10 rule.
8. Dokumen punya checklist, status, tanggal, aging, upload, dan owner.
9. Quality punya comparison dan warning.
10. Payment/Freight/P&L saling terhubung.
11. Dashboard menampilkan blocker.
12. Closing punya validation rule.
13. Approval dan audit trail tersimpan untuk critical action.
