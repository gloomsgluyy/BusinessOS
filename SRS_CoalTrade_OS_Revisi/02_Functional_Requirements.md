# Functional Requirements

Requirement ID menggunakan prefix:

- `FR` untuk functional requirement umum.
- `WF` untuk workflow requirement.
- `BR` untuk business rule.
- `AC` untuk acceptance criteria.

## 1. Market Price

### FR-MP-001 Market Reference Input

Sistem harus menyediakan Market Price sebagai referensi harga untuk Sales Offer dan P&L.

Data minimal:

- ICI 1 sampai ICI 5,
- NEWC/Newcastle,
- HBA/HPB,
- MGO,
- FX rate,
- freight indicator,
- source/reference,
- update time,
- updated by,
- history per day.

Priority: Medium

Acceptance Criteria:

- User authorized dapat input/update market price.
- Update market price per hari menyimpan history.
- Sales/P&L dapat membaca latest price.
- Dashboard atau module terkait dapat memberi warning jika offer price jauh dari reference.

## 2. Forecast Sales and FCO

### FR-FS-001 Rename Projects to Forecast Sales

Modul lama Projects harus diganti secara product-facing menjadi Forecast Sales. Istilah Project hanya boleh tersisa sebagai compatibility/internal reference jika masih dibutuhkan oleh database atau migrasi lama.

Priority: Very High

Acceptance Criteria:

- Sidebar, page title, action label, dan dokumen SRS memakai istilah Forecast Sales.
- Record lama dari Projects tetap terbaca sebagai Forecast Sales.
- Shipment tetap dapat menampilkan asalnya dari Forecast Sales.
- Tidak ada workflow baru yang meminta user membuat "Project" sebagai langkah terpisah dari Forecast Sales.

### FR-FS-002 Forecast Sales Draft and Offer Profile

Forecast Sales harus mengelola rencana penjualan bulanan dan offer profile sebelum shipment.

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
- sales term such as FOB, CIF, CNF/CFR, FAS or custom,
- target selling price,
- price basis: Fixed, ICI, NEWC/Newcastle, HBA/HPB, formula, or custom,
- payment term,
- surveyor,
- supplier candidates,
- requested coal specification: GAR/GCV, NAR if used, TM, IM, TS, Ash, VM, HGI, Size,
- internal notes,
- market price reference snapshot,
- historical selling price reference.

Priority: Very High

Acceptance Criteria:

- Trader dapat menyimpan draft walau mandatory fields belum lengkap.
- Mandatory fields harus lengkap sebelum Submit Offer Profile.
- Trader name default otomatis dari user login.
- Market reference dan historical selling price tampil di offer form.
- Sistem memberi warning jika target selling price terlalu rendah dibanding market reference atau historical selling price.

### FR-FS-003 Supplier Candidate and Quality Fit

Forecast Sales harus dapat memilih beberapa supplier/source candidate dari Source module dan membandingkan kualitas serta harga terhadap requested coal specification.

Data minimal per candidate:

- source/supplier,
- available stock/COB,
- source location/stockpile if available,
- supplier price or FOB barge price,
- GAR/GCV,
- TM,
- TS,
- Ash,
- VM,
- HGI,
- Size,
- readiness status,
- notes.

Priority: Very High

Acceptance Criteria:

- User dapat menambahkan lebih dari satu supplier candidate.
- Sistem menampilkan candidate yang paling dekat dengan requested spec.
- Jika candidate quality berada di bawah requested spec, sistem menampilkan warning/notice.
- User dapat lanjut menggunakan candidate di bawah spec hanya dengan reason/acknowledgment.
- Candidate terpilih menjadi selected supplier/source untuk offer dan shipment conversion.

### FR-FS-004 Embedded Blending Simulation

Selain modul Blending Simulation mandiri, Forecast Sales harus memiliki blending simulation di dalam offer input agar trader dapat membandingkan supplier candidate sebelum submit.

Input minimal:

- supplier A/B/C or more,
- quantity per supplier,
- GAR/GCV,
- TM,
- TS,
- Ash,
- VM if available,
- supplier price/cost per MT.

Output minimal:

- final estimated GAR/GCV,
- final estimated TM,
- final estimated TS,
- final estimated Ash,
- final estimated VM if available,
- average supplier cost,
- estimated blended cost,
- pass/warning/not recommended against requested spec.

Priority: High

Acceptance Criteria:

- Trader dapat menjalankan simulasi sebelum submit offer.
- Hasil simulasi dapat disimpan sebagai reference offer.
- Hasil simulasi tidak menggantikan data quality final.
- Jika hasil blending di bawah requested spec, warning tersimpan di offer profile.

### FR-FS-005 Restricted Rough P&L

Sistem harus membuat rough P&L otomatis setelah trader submit offer profile.

Input/source minimal:

- selling price,
- supplier price,
- quantity,
- selected supplier/blending cost,
- freight estimate if available,
- surveyor cost,
- royalty/tax/export cost if applicable,
- other cost,
- estimated revenue,
- total estimated cost.

Output minimal:

- estimated gross profit,
- margin per MT,
- margin percentage,
- risk/warning if margin too low.

Priority: High

Acceptance Criteria:

- Rough P&L dibuat otomatis setelah submit offer profile.
- Rough P&L hanya dapat dilihat oleh CEO, DIRUT, ASS_DIRUT, COO, atau management role yang ditentukan.
- Trader umum tidak dapat melihat nilai P&L restricted.
- Perubahan price, quantity, supplier, blending, freight, atau cost membuat P&L recalculated dan tersimpan revision log.

### FR-FS-006 CEO Approval Workflow

Offer profile harus melewati status approval sebelum FCO dapat digenerate.

Status minimal:

- Draft,
- Submitted to CEO,
- CEO Review,
- Revision Requested,
- Approved,
- Rejected.

Priority: Very High

Acceptance Criteria:

- Draft dapat disimpan tanpa semua mandatory fields.
- Submit to CEO diblokir jika mandatory fields belum lengkap.
- Approval/rejection/revision request wajib punya comment atau reason.
- Approval history tersimpan dengan user, role, timestamp, comment, and status.
- Jika Approved, FCO generation terbuka.
- Jika Rejected, record tidak dapat lanjut ke FCO tanpa resubmission/revision.

### FR-FS-007 FCO Number and FCO Generator

Sistem harus dapat generate Full Corporate Offer PDF berdasarkan Forecast Sales yang approved.

FCO field minimal berdasarkan contoh `FCO.C2604 (1).pdf`:

- FCO number auto generated and unique,
- date,
- buyer/to,
- attention/contact person,
- declaration statement,
- commodity,
- coal quality table with parameter, basis, unit, typical, lowest limit,
- origin,
- quantity and tolerance,
- laycan,
- port of loading,
- base price,
- price adjustment formula,
- shipping terms,
- loading rate clause,
- payment terms,
- independent surveyor,
- other terms,
- validity,
- seller/company signature block.

Priority: Very High

Acceptance Criteria:

- FCO number auto generated and unique.
- FCO PDF tidak dapat didownload sebelum approval status Approved.
- FCO generator memakai data Forecast Sales, supplier candidate, quality spec, sales term, and price basis.
- FCO clause dapat berubah berdasarkan sales term/template, contoh FOB memakai loading rate and laytime clause.
- FCO sent date dan sent by tersimpan ketika user menandai FCO sent to buyer.
- FCO revision membuat version baru, bukan overwrite.

### FR-FS-008 Buyer Feedback and Deal Result

Setelah FCO dikirim ke buyer, Forecast Sales harus mencatat feedback buyer dan hasil offer.

Status minimal:

- FCO Sent,
- Waiting Buyer Feedback,
- Negotiation/Pending,
- Deal,
- Failed.

Priority: Very High

Acceptance Criteria:

- Trader dapat update buyer feedback.
- Jika status Failed, failed reason wajib diisi.
- Failed reason category minimal: price issue, quality issue, laycan issue, payment term issue, stock/source issue, buyer cancelled, other.
- Jika Failed, sistem mengirim notification/alert ke CEO/management.
- Jika Deal, sistem dapat convert otomatis atau one-click ke Shipment Monitor.

### FR-FS-009 Convert Deal to Shipment

Saat Forecast Sales berstatus Deal, sistem harus bisa membuat Shipment Monitor record.

Priority: Very High

Acceptance Criteria:

- Tersedia action Convert to Shipment atau auto-create shipment setelah status Deal.
- Data buyer, commodity, quantity, cargo specification, laycan/delivery window, POL, sales price, payment term, surveyor, supplier/source, and PIC trader ikut terbawa.
- Shipment ID dibuat otomatis.
- Forecast Sales menyimpan linked shipment ID.
- Shipment awal tampil sebagai Upcoming/Draft Shipment sesuai status operasional.

### FR-FS-010 Forecast Sales Management Dashboard

Di bagian atas Forecast Sales harus ada dashboard management ringkas.

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
- estimated margin/P&L CEO only.

Priority: High

Acceptance Criteria:

- Metric dapat difilter by month, trader, buyer, status.
- Metric revenue dan margin mengikuti role access.
- Management dapat membuka record terkait dari dashboard metric.
- Trader dapat melihat metric miliknya sendiri sesuai permission.

### FR-FS-011 Price and Laycan Revision Log

Setiap revisi target selling price, final selling price, price basis, quantity, laycan, supplier candidate, selected supplier, dan sales term harus tersimpan sebagai revision log.

Priority: High

Acceptance Criteria:

- Revision log menyimpan old value, new value, reason, user, timestamp, and approval reference if any.
- Revisi setelah CEO approval membutuhkan resubmission or approval rule sesuai policy.
- Revision history dapat dilihat oleh management dan owner trader.

## 3. Shipment Monitor

### FR-SH-001 Shipment Monitor as Operational Control Center

Shipment Monitor harus menjadi pusat kontrol operasional, bukan satu tabel panjang.

Sub-tab minimal:

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

Priority: Very High

Acceptance Criteria:

- User dapat melihat shipment detail dalam section/sub-tab.
- Data utama shipment tidak hilang dari table summary.
- Edit data dilakukan sesuai ownership dan permission.
- UI tidak memaksa user scroll tabel horizontal panjang untuk workflow harian.

### FR-SH-002 Shipment Header

Shipment Header harus menyimpan:

- Shipment ID,
- type export/domestic,
- buyer,
- Forecast Sales reference,
- product,
- qty plan,
- POL,
- POD,
- laycan,
- status,
- PIC.

Priority: Very High

Acceptance Criteria:

- Header dibuat dari Forecast Sales/Sales saat converted.
- Header dapat diedit oleh Sales/Traffic sesuai permission.
- Perubahan field penting tersimpan audit trail.

### FR-SH-003 Commercial Reference

Commercial Reference harus link ke FCO/MoM/PO, contract no., shipping term, price, invoice amount, payment term, dan bank info.

Priority: High

Acceptance Criteria:

- Commercial docs dari Forecast Sales/Sales dapat tampil sebagai reference di Shipment.
- Shipment tidak perlu upload ulang dokumen yang sudah dimiliki Forecast Sales/Sales.
- P&L dapat menarik sales price, quantity, dan term.

### FR-SH-004 Issue Log

Setiap issue harus memiliki:

- issue category,
- description,
- impact,
- action plan,
- PIC,
- target date,
- status,
- evidence if needed.

Priority: High

Acceptance Criteria:

- Status Issue/Hold/Cancelled wajib reason.
- Open issue tampil di Dashboard.
- Closing diblokir jika issue belum clear atau belum punya reason.

### FR-SH-005 Shipment Data Completeness Score

Shipment Monitor harus menampilkan persentase kelengkapan data untuk setiap shipment agar user tahu record mana yang masih kosong, asal input, atau belum siap diproses.

Field group minimal untuk dihitung:

- header identity: shipment ID, Forecast Sales reference, buyer, type, PIC,
- commercial: sales price, buying price, quantity, payment term, shipping term,
- source: supplier/source, IUP OP, origin, stock/COB, readiness,
- route and schedule: POL, POD, laycan, vessel/barge/nomination,
- quality: requested spec, latest actual/estimated spec,
- SI: SI data fields and status,
- documents: required document checklist,
- payment: invoice/payment status if applicable,
- issue/closing: open issue, reason, final quantity.

Priority: High

Acceptance Criteria:

- Setiap shipment menampilkan completion percentage.
- User dapat melihat daftar missing fields atau weak fields.
- Mandatory field kosong menurunkan score dan memberi warning.
- Input placeholder seperti `-`, `0`, `N/A`, atau nilai default yang tidak valid tidak dihitung sebagai data valid untuk field wajib.
- Closing tetap menggunakan closing validation, bukan hanya completion percentage.

## 4. Source

### FR-SRC-001 Source Confirmation Workflow

Source module harus mengelola source/supplier dan cargo readiness.

Data minimal:

- shipment/Forecast Sales reference,
- origin,
- source,
- supplier,
- IUP OP,
- RKAB,
- kuota export,
- source contract,
- legal status,
- jetty/loading port,
- loading slot,
- stock ready,
- COB,
- hauling readiness,
- readiness date,
- remarks,
- evidence upload.

Priority: High

Acceptance Criteria:

- Source request dapat dibuat dari Shipment Monitor.
- Source Team dapat submit Source Result.
- Source not ready wajib reason dan estimated readiness date.
- Source result tampil di Shipment Monitor.

### FR-SRC-002 Domestic Source Scope

Untuk domestic shipment, Source Team hanya bertanggung jawab sampai source confirmation. Final TB/BG nomination dimiliki Sales/Traffic.

Priority: Very High

Acceptance Criteria:

- UI/permission tidak menyatakan Source Team sebagai owner final domestic TB/BG.
- Domestic final nomination disimpan di Shipment Monitor.
- Barge change untuk domestic masuk Barge Change Log.

## 5. Source Change Traceability

### FR-SCT-001 Source Change Request

Sistem harus menyediakan Source Change Traceability untuk semua perubahan source/supplier.

Field wajib:

- Shipment ID / Forecast Sales ID,
- current source,
- current supplier,
- new source,
- new supplier,
- requested by,
- request date,
- reason category,
- reason detail,
- evidence upload,
- impact to laycan/qty/quality/cost/contract/SI,
- CEO approval status,
- new source contract status,
- active source version,
- revision history.

Priority: Very High

Acceptance Criteria:

- Source lama tetap tersimpan.
- Source baru tidak aktif sebelum approval rule terpenuhi.
- CEO approval status tercatat.
- Active source version jelas.
- Dashboard menampilkan pending source change.

### BR-SCT-001 Source Change Activation Rule

New source hanya menjadi active jika:

1. reason terisi,
2. evidence tersedia,
3. CEO approval approved/acknowledged sesuai rule,
4. new source contract status approved/active.

## 6. Quality

### FR-QLT-001 Quality Workflow

Quality module harus menjadi workflow QC lengkap.

Section minimal:

- Contract Spec,
- Source Quality Estimate,
- QC Result,
- PSI Result,
- COA POL,
- COA POD,
- Quality Comparison.

Priority: High

Acceptance Criteria:

- Semua quality data link ke shipment/Forecast Sales.
- Quality Team dapat input QC/PSI/COA.
- Sales/Traffic dapat view quality status.
- Missing mandatory quality tampil sebagai dashboard alert.

### FR-QLT-002 Quality Comparison

Sistem harus membandingkan contract spec vs source estimate vs QC vs PSI vs COA POL vs COA POD.

Parameter:

- GAR/GCV,
- NAR,
- TM,
- IM,
- TS,
- Ash,
- VM,
- HGI,
- Size,
- analysis method.

Output:

- Passed,
- Warning,
- Need Review,
- Claim Potential,
- Rejected.

Priority: High

Acceptance Criteria:

- Selisih terhadap contract spec dihitung.
- Warning muncul jika melewati tolerance.
- Warning memblokir closing sampai reviewed.

## 7. Shipping Instruction

### FR-SI-001 SI Per Shipment

SI harus generated per shipment berdasarkan Forecast Sales/deal dan shipment data.

Field minimal:

- SI number,
- SI version,
- shipment ID,
- Forecast Sales ID,
- buyer,
- supplier,
- source,
- POL,
- POD,
- laycan,
- product,
- spec,
- quantity,
- tolerance,
- vessel/barge nomination,
- contract/FCO/MoM/PO reference,
- document required,
- remarks,
- approval status,
- PDF output.

Priority: Very High

Acceptance Criteria:

- SI tidak menjadi upload manual utama.
- SI PDF dapat digenerate dari data shipment.
- SI menampilkan Forecast Sales asal.
- Perubahan shipment data tercermin pada SI generated terbaru.

### BR-SI-001 H-10 Rule

Normal SI hanya dapat issued minimal H-10 dari first day laycan.

Acceptance Criteria:

- Jika user issue sebelum H-10, sistem mendeteksi early issue.
- Early SI wajib reason dan CEO approval/acknowledgment.
- Approval history tersimpan.

### FR-SI-002 SI Revision

Revisi SI wajib:

1. revisi data Forecast Sales/Shipment terkait lebih dulu,
2. membuat SI Revision Request,
3. mengisi reason,
4. attach evidence,
5. CEO approval/acknowledgment,
6. generate version baru.

Acceptance Criteria:

- Old SI tetap tersimpan.
- SI version bertambah.
- Revision log mencatat user, time, reason, evidence, approval.

### FR-SI-003 SI Cancellation

SI cancellation harus memiliki reason, evidence, CEO acknowledgment/approval, dan status inactive/superseded.

## 8. Barge Change Log

### FR-BCL-001 Barge Change Traceability

Sistem harus mencatat setiap perubahan MV/TB/BG.

Field wajib:

- Shipment ID,
- old MV/TB/BG,
- new MV/TB/BG,
- change date/time,
- changed by,
- department,
- reason category,
- reason detail,
- evidence upload,
- approval required,
- approved by,
- status active/rejected/cancelled/superseded.

Priority: Very High

Acceptance Criteria:

- Perubahan nomination tidak overwrite data lama.
- Latest active nomination dapat dilihat.
- History semua perubahan dapat dilihat.
- Source dan Quality dapat diberi notice jika change berdampak ke schedule/cargo/quality.

## 9. Document Checklist

### FR-DOC-001 Document Checklist with Aging

Setiap required document harus memiliki:

- document name,
- required/optional,
- responsible party,
- status,
- received date,
- submitted date,
- submitted to,
- aging days,
- file upload,
- hardcopy status,
- notes.

Priority: Very High

Acceptance Criteria:

- Aging dihitung otomatis.
- Missing mandatory docs tampil alert.
- Closing diblokir jika mandatory docs incomplete.

### FR-DOC-002 Document Owner Location

Dokumen harus diinput di modul owner:

- Commercial: Forecast Sales / Sales Monitor
- Source / Legal: Source
- Quality / COA: Quality
- Shipment Operation: Shipment Monitor
- Payment: Outstanding Payment
- Freight / Cost: Transshipment / Freight
- Issue Evidence: Issue Log

Acceptance Criteria:

- Shipment Monitor dapat menampilkan linked reference.
- Owner module tetap jelas.
- Tidak perlu upload ganda jika dokumen sudah ada di module owner.

## 10. Domestic Document Handover

### FR-DDH-001 Domestic Document Flow

Domestic shipment harus punya handover tracking untuk:

- SKAB-SK,
- DSR Carbon,
- BL/CM,
- COA POL,
- COA POD,
- Time Sertif,
- Terpal,
- Insurance,
- Invoice,
- POD report,
- Weightbridge report,
- full set docs,
- hardcopy,
- softcopy.

Priority: High

Acceptance Criteria:

- Setiap document flow punya tanggal perpindahan antar pihak.
- Aging per tahap dihitung.
- Dashboard menampilkan dokumen domestic yang nyangkut.

## 11. Payment

### FR-PAY-001 Buyer Payment Tracking

Outstanding Payment harus link ke shipment.

Field minimal:

- invoice amount,
- invoice price,
- payment term,
- due date,
- submit docs to bank/buyer,
- received payment date,
- payment status,
- dispute amount,
- overdue days.

Priority: High

Acceptance Criteria:

- Payment overdue tampil di dashboard.
- Payment status mempengaruhi closing.
- P&L dapat menarik invoice amount/payment status.

### FR-PAY-002 Vendor Payment Tracking

Vendor payment harus mencatat:

- vendor invoice receive,
- submit system,
- approval DT/RH,
- submit finance,
- paid date,
- paid to vendor,
- aging.

## 12. Transshipment / Freight

### FR-FRT-001 Freight and Logistics Cost

Transshipment/Freight harus mengelola:

- freight price,
- barging,
- allowance,
- demurrage/despatch,
- SPAL,
- no SI,
- sent to supplier/barge owner,
- PBM,
- PNBP/STS,
- laytime calculation.

Priority: Medium

Acceptance Criteria:

- Freight cost link ke shipment.
- Cost masuk ke P&L.
- Freight/cost documents punya upload dan status.

## 13. P&L

### FR-PL-001 Estimated and Actual P&L

P&L harus menarik data dari modul lain sebanyak mungkin.

Input/source:

- selling price dari Sales/Shipment,
- supplier price dari Source/Shipment,
- freight dari Transshipment/Freight,
- barging/PBM/PNBP dari Freight/Expenses,
- final quantity dari Shipment,
- invoice amount dari Payment,
- expenses dari Expenses.

Output:

- estimated margin,
- actual margin,
- margin/MT,
- total margin,
- cost deviation.

Priority: Medium

Acceptance Criteria:

- P&L tidak seluruhnya manual.
- Perubahan final qty/cost mempengaruhi actual P&L.
- Restricted view untuk Management sesuai permission.

## 14. Dashboard

### FR-DSH-001 Alert-Based Dashboard

Dashboard harus menampilkan:

- Forecast Sales status summary,
- pending CEO offer approval,
- pending buyer feedback,
- failed offer alert,
- shipment by status,
- export vs domestic count,
- source pending,
- quality warning,
- document aging,
- barge change history,
- source change history,
- SI approval queue,
- FCO approval/FCO sent activity,
- payment outstanding,
- open issues,
- P&L summary.

Priority: High

Acceptance Criteria:

- Dashboard dapat dipakai sebagai daily control tower.
- Alert clickable menuju record terkait.
- Data disaring berdasarkan access role.

## 15. Approval Center

### FR-APR-001 Central Approval Queue

Approval Center harus mengumpulkan approval:

- offer profile approval,
- FCO approval,
- FCO revision approval if required,
- early SI approval,
- SI revision approval,
- SI cancellation approval,
- source change approval,
- optional barge change approval,
- high-risk issue acknowledgment.

Priority: Medium

Acceptance Criteria:

- CEO/Management dapat melihat pending approvals.
- Approval history tersimpan.
- Approved/rejected/acknowledged mempengaruhi status entity terkait.

## 16. Audit Trail

### FR-AUD-001 Critical Field Audit

Sistem harus mencatat user, timestamp, old value, new value, reason, evidence untuk perubahan kritikal.

Critical changes:

- Forecast Sales price/laycan/quantity/supplier candidate change,
- FCO generation/revision/cancellation,
- source change,
- supplier change,
- MV/TB/BG change,
- SI generation/revision/cancellation,
- shipment status change to Issue/Hold/Cancelled/Closed,
- quality warning review,
- payment status update,
- P&L restricted change.

Priority: High

Acceptance Criteria:

- Audit log dapat difilter per module/entity.
- Record lama tidak hilang.
- Tidak ada critical update tanpa user dan timestamp.
