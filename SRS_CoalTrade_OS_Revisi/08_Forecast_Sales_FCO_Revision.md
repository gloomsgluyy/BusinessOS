# Forecast Sales and FCO Revision SRS

## 1. Purpose

Dokumen ini menambahkan revisi lisan tanggal 2026-05-23 ke SRS utama. Revisi ini terutama mengubah konsep modul lama `Projects` menjadi `Forecast Sales`, memperjelas workflow offer/FCO sebelum shipment, menambahkan supplier candidate comparison, embedded blending simulation, restricted rough P&L, buyer feedback, dan shipment data completeness.

## 2. Interpretation of Oral Revision

Beberapa kata dari voice-to-text perlu dinormalisasi agar menjadi requirement yang konsisten:

| Voice-to-text phrase | Interpreted system term |
|---|---|
| Project / at-over / over | Forecast Sales / Offer Profile |
| Bayer / bayar | Buyer |
| laken / laken for | Laycan / delivery window |
| Cell Storm / sale storm | Sales term / shipping term |
| target selling press | Target selling price |
| IC e New CBR | ICI / NEWC / Newcastle reference |
| hpb | HPB/HBA reference |
| gar tmts VM Edge | GAR, TM, TS, VM, Ash |
| submit porsio/profile | Submit Offer Profile |
| si o / CEO | CEO / management approver |
| televisi | Revision Requested |
| velg / file / fail | Failed |
| FCO send ke jalan Bayer | FCO sent to Buyer |
| rough VN / rompi NL | Rough P&L |

## 3. Comparison Against Existing SRS

| Revisi Lisan | Status di SRS v1.0 | Action di SRS v1.1 |
|---|---|---|
| Rename Projects menjadi Forecast Sales | Belum jelas, masih ada Projects sebagai modul utama | Ditambahkan sebagai FR-FS-001 dan modul Forecast Sales |
| Trader input rencana penjualan bulanan | Ada secara umum di Sales Monitor | Diperdetail sebagai Forecast Sales Draft and Offer Profile |
| Market reference dan historical selling price di offer | Market reference ada, historical selling price belum tegas | Ditambahkan ke Forecast Sales |
| Warning jika selling price terlalu rendah | Ada umum di Market Price | Dipindahkan menjadi acceptance Forecast Sales |
| Input coal spec lengkap | Ada di Quality, belum di offer profile | Ditambahkan ke Forecast Sales Product Specification |
| Supplier candidate dari Source | Belum detail | Ditambahkan Supplier Candidate and Quality Fit |
| Candidate quality dibandingkan requested spec | Belum ada | Ditambahkan warning/acknowledgment rule |
| Blending simulation di dalam Forecast Sales | Blending hanya modul terpisah | Ditambahkan Embedded Blending Simulation |
| Rough P&L auto setelah submit offer | Ada P&L umum, belum rough P&L restricted | Ditambahkan Restricted Rough P&L |
| CEO approval sebelum FCO | Ada FCO approval umum | Diperdetail dengan status Draft -> Submitted -> Approved/Rejected |
| FCO PDF generator dari template | Belum detail | Ditambahkan FCO Generator berdasarkan `FCO.C2604 (1).pdf` |
| FCO number auto generated and unique | Belum tegas | Ditambahkan |
| FCO tidak bisa download sebelum approved | Belum tegas | Ditambahkan sebagai blocker |
| Buyer feedback: pending/deal/failed | Ada umum | Diperdetail |
| Failed wajib reason dan notifikasi CEO | Belum tegas | Ditambahkan |
| Deal auto carry ke Shipment Monitor | Ada convert umum | Diperdetail field mapping |
| Revisi price/laycan harus ada revision log | Belum tegas | Ditambahkan |
| Forecast Sales top dashboard | Belum ada | Ditambahkan |
| Shipment Monitor completion percentage | Belum ada | Ditambahkan FR-SH-005 |

## 4. Forecast Sales Workflow

### UI-FS-001 Dashboard Summary Drilldown Layout

Forecast Sales dashboard summary cards harus tetap terbaca saat salah satu card drilldown dibuka.

Rules:

- Membuka dropdown pada satu summary card tidak boleh membuat card summary lain ikut memanjang secara visual.
- Card summary harus cukup lebar untuk membaca label, angka, buyer, offer-by, dan status.
- Dropdown item harus menampilkan minimal Forecast Sales name, buyer, offer by, dan status.
- Layout desktop boleh memakai beberapa row agar card tidak terlalu gepeng.
- Dropdown harus scroll internal jika list terlalu panjang.

### WF-FS-001 Draft

Trader dapat membuat Forecast Sales sebagai draft.

Rules:

- Draft dapat incomplete.
- Draft menyimpan created by, trader name, created at, updated at.
- Draft hanya dapat diedit oleh owner trader, management, atau role yang diberi permission.

### WF-FS-002 Complete Offer Profile

Sebelum submit, mandatory fields harus lengkap:

- forecast month,
- offer/project name,
- buyer name,
- buyer country,
- commodity/product,
- quantity,
- laycan/delivery window,
- port of loading,
- sales term,
- target selling price,
- price basis,
- payment term,
- surveyor,
- requested coal spec,
- at least one supplier candidate,
- selected supplier candidate or saved blending scenario,
- internal notes if any warning is acknowledged.

### WF-FS-003 Submit to CEO

Saat trader klik Submit Offer Profile:

- Sistem validasi mandatory fields.
- Sistem membuat rough P&L restricted.
- Sistem membuat approval request.
- Status menjadi Submitted to CEO atau CEO Review.
- Notification dikirim ke CEO/management.

### WF-FS-004 CEO Decision

CEO/management dapat:

- Approve,
- Request Revision,
- Reject.

Rules:

- Semua action wajib comment.
- Revision Requested mengembalikan ke trader untuk update.
- Rejected tidak dapat lanjut ke FCO kecuali dibuat revision/resubmission sesuai policy.
- Approved membuka FCO generator.

### WF-FS-005 Generate and Send FCO

Setelah Approved:

- FCO number dibuat otomatis dan unik.
- FCO PDF dapat digenerate/didownload.
- User dapat menandai FCO Sent to Buyer.
- Sent status menyimpan sent by, sent at, buyer contact, dan notes.

### WF-FS-006 Buyer Feedback

Setelah FCO Sent:

- Waiting Buyer Feedback,
- Negotiation/Pending,
- Deal,
- Failed.

Rules:

- Failed wajib failed reason.
- Failed mengirim alert ke CEO/management.
- Deal membuka conversion ke Shipment Monitor.

### WF-FS-007 Convert to Shipment

Saat Deal:

- Sistem membuat Shipment ID.
- Shipment awal masuk Upcoming/Draft Shipment atau Waiting Source Confirmation.
- Forecast Sales menyimpan linked shipment ID.
- Shipment menyimpan Forecast Sales reference.

## 5. Forecast Sales Data Model

### ForecastSales

Minimal fields:

- id,
- forecastNumber,
- forecastMonth,
- offerName,
- traderUserId,
- traderName,
- buyerName,
- buyerCountry,
- commodity,
- quantity,
- laycanStart,
- laycanEnd,
- deliveryWindowText,
- portOfLoading,
- portOfDischarge if known,
- salesTerm,
- targetSellingPrice,
- finalSellingPrice,
- priceBasis,
- paymentTerm,
- surveyor,
- requestedSpecId or embedded requested spec,
- selectedSupplierCandidateId,
- selectedBlendingScenarioId,
- status,
- approvalStatus,
- fcoNumber,
- fcoStatus,
- buyerFeedbackStatus,
- failedReasonCategory,
- failedReasonDetail,
- linkedShipmentId,
- createdAt,
- updatedAt,
- isDeleted.

### ForecastSalesSpec

Minimal fields:

- forecastSalesId,
- gar,
- gcv,
- nar,
- tm,
- im,
- ts,
- ash,
- vm,
- hgi,
- size,
- analysisMethod,
- lowestLimitGar,
- toleranceNotes.

### ForecastSupplierCandidate

Minimal fields:

- forecastSalesId,
- sourceId,
- supplierName,
- sourceName,
- origin,
- stockAvailable,
- stockLocationsSnapshot,
- supplierPrice,
- fobBargePrice,
- readinessStatus,
- gar,
- tm,
- ts,
- ash,
- vm,
- hgi,
- size,
- fitScore,
- warningLevel,
- warningReason,
- acceptedBelowSpec,
- acceptanceReason,
- notes.

### ForecastBlendingScenario

Minimal fields:

- forecastSalesId,
- scenarioName,
- inputCandidates,
- quantitySplit,
- finalGar,
- finalTm,
- finalTs,
- finalAsh,
- finalVm,
- averageCost,
- estimatedBlendedCost,
- resultStatus,
- warningReason,
- createdBy,
- createdAt.

### ForecastRoughPL

Minimal fields:

- forecastSalesId,
- sellingPrice,
- supplierPrice,
- quantity,
- supplierCost,
- blendingCost,
- freightEstimate,
- surveyorCost,
- royaltyCost,
- taxCost,
- exportCost,
- otherCost,
- estimatedRevenue,
- totalEstimatedCost,
- estimatedGrossProfit,
- marginPerMt,
- marginPercent,
- visibilityRole,
- generatedAt.

### FcoDocument

Minimal fields:

- id,
- forecastSalesId,
- fcoNumber,
- version,
- status,
- generatedBy,
- generatedAt,
- approvedFromApprovalId,
- sentBy,
- sentAt,
- buyerContact,
- pdfStorageKey,
- revisionReason,
- isActive.

## 6. FCO Generator Requirement

FCO generator harus dapat membuat PDF dari Forecast Sales approved. Template awal mengikuti contoh `FCO.C2604 (1).pdf`.

### FCO Output Structure

1. Title: FULL CORPORATE OFFER
2. Header:
   - Date
   - To
   - No.
   - For Attention
3. Declaration statement:
   - Seller declares ready, willing, and capable to sell the commodity.
4. Commercial and technical clauses:
   - A. Commodity
   - B. Coal Quality
   - C. Origin
   - D. Quantity
   - E. Laycan
   - F. Port of Loading
   - G. Base Price
   - H. Price Adjustment
   - I. Shipping Terms
   - J. Loading Rate
   - K. Payment Terms
   - L. Independent Surveyor
   - M. Other Terms
   - N. Validity
5. Closing sentence and signature block.

### Coal Quality Table

Columns:

- Parameter,
- Basis,
- Unit,
- Typical,
- Lowest Limit or max/min note.

Rows minimal:

- Gross Calorific Value,
- Total Moisture,
- Inherent Moisture,
- Total Sulphur,
- Ash Content,
- Volatile Matter,
- Fixed Carbon,
- HGI,
- Size.

### Clause Presets

The system must support clause presets:

- FOB geared and grabbed,
- FOB gearless mother vessel,
- CIF,
- CNF/CFR,
- custom.

FOB example default:

- loading rate 8,000 MT for geared and grabbed,
- loading rate 10,000 MT for gearless,
- PWWD SHINC except major Indonesian holidays,
- buyer nominates vessel before laycan according to configured rule,
- laytime and detention clauses editable by authorized role.

## 7. Business Rules

### BR-FS-001 Mandatory Submit Rule

Submit Offer Profile is blocked if mandatory fields are incomplete.

### BR-FS-002 Approval Before FCO

FCO generation, FCO download, and FCO sent status are blocked until Forecast Sales status is Approved.

### BR-FS-003 Failed Reason Rule

Failed status requires failed reason category and failed reason detail.

### BR-FS-004 Deal Conversion Rule

Deal status must create or link Shipment Monitor record.

### BR-FS-005 Restricted P&L Rule

Rough P&L values are hidden from general trader roles.

### BR-FS-006 Revision Log Rule

Price, quantity, laycan, selected supplier, supplier candidate, sales term, and FCO revision must create revision log.

### BR-FS-007 Below Spec Candidate Rule

If selected supplier/blending result is below requested spec, user must provide acknowledgment reason before submit.

## 8. Shipment Data Completeness Requirement

Shipment Monitor must show a data completeness percentage per shipment.

### Completion Groups

- Header identity,
- Forecast Sales reference,
- commercial and finance,
- source and supplier,
- route and laycan,
- vessel/barge nomination,
- quality,
- SI,
- required documents,
- payment,
- issue and closing.

### Invalid Values

The following values must not count as complete for mandatory fields:

- empty string,
- null,
- dash `-`,
- `N/A`,
- zero for fields where zero is not a valid business value,
- placeholder/default dummy text.

### Output

- percentage score,
- missing field list,
- warning level,
- last updated timestamp,
- updated by.

## 9. Dashboard Requirement

Forecast Sales dashboard must include:

- total forecast this month,
- total draft offer,
- total submitted/CEO review,
- total approved offer,
- total FCO sent,
- pending buyer feedback,
- total deal,
- total failed,
- failed reason summary,
- estimated revenue,
- estimated margin/P&L for CEO only.

## 10. Acceptance Criteria

1. User sees Forecast Sales instead of Projects in product-facing labels.
2. Trader can save incomplete draft.
3. Trader cannot submit incomplete offer profile.
4. Market reference and historical selling price are visible in offer form.
5. Supplier candidates compare against requested coal spec.
6. Candidate below spec creates warning and requires acknowledgment.
7. Embedded blending simulation can save scenario output.
8. Rough P&L is generated and hidden from general trader.
9. CEO approval is required before FCO generation/download.
10. FCO number is unique and auto generated.
11. FCO output follows the approved template structure.
12. Buyer feedback status can be tracked after FCO sent.
13. Failed status requires reason and alerts CEO/management.
14. Deal status creates/links shipment.
15. Price/laycan/supplier/FCO revisions create revision log.
16. Shipment Monitor shows data completeness percentage and missing fields.
