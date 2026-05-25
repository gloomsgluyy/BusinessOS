# Document Management SRS

## 1. Purpose

Document management harus memastikan dokumen tidak hilang, tidak salah tempat upload, tidak terlambat tanpa alert, dan dapat dipakai untuk closing, payment, quality, serta audit.

## 2. Document Ownership Rule

Dokumen harus diinput/upload di module yang memiliki prosesnya.

| Document Category | Input Module | Owner | Rule |
|---|---|---|---|
| Commercial | Forecast Sales / Sales Monitor | Sales / Traffic | Link ke shipment setelah deal confirmed. |
| FCO | Forecast Sales | Sales / Traffic with CEO approval | Generated from approved Forecast Sales, bukan upload manual utama. |
| Source / Legal | Source | Source Team | Dokumen supplier/source tidak diupload utama di shipment. |
| Source Evidence | Source | Source Team | Wajib jika source/cargo readiness issue. |
| Quality | Quality | Quality Team | QC/PSI/COA wajib link ke shipment. |
| SI | Shipment Monitor - SI Management | Sales / Traffic | SI generated per shipment dan punya version history. |
| Export Shipment Docs | Shipment Monitor - Document Checklist | Sales / Traffic | VesNom, Stowage Plan, NOR POL, BL, PEB, LHV, Surveyor LS. |
| Domestic Shipment Docs | Shipment Monitor - Domestic Document Handover | Sales / Traffic | SKAB, DSR, BL/CM, COA, Time Sertif, full set docs. |
| POD Docs | Shipment Monitor | Sales / Traffic | Discharge report, POD report, weightbridge. |
| Payment Docs | Outstanding Payment + Shipment Monitor reference | Sales / Traffic / Finance | Invoice, full set docs, payment proof. |
| Freight / Cost Docs | Transshipment / Freight | Sales / Traffic | SPAL, freight invoice, PBM, PNBP/STS. |
| Issue Evidence | Issue Log | Related Team | Wajib jika ada issue. |

## 3. Common Document Fields

Setiap document record minimal memiliki:

- document ID,
- linked module,
- linked Forecast Sales ID / legacy project ID,
- linked shipment ID,
- document category,
- document name,
- required/optional flag,
- owner role,
- responsible party,
- status,
- received date,
- submitted date,
- submitted to,
- aging days,
- hardcopy status,
- file upload(s),
- uploaded by,
- uploaded at,
- notes,
- revision/replacement history if applicable.

## 4. Status

Allowed status:

- Pending
- Received
- Submitted
- Completed
- Not Required
- Rejected
- Superseded

## 5. Aging Rules

### AG-001 Pending Aging

Jika document status Pending dan expected date sudah lewat, aging dihitung dari expected/required date sampai hari ini.

### AG-002 Received but Not Submitted

Jika received date terisi tetapi submitted date kosong, aging dihitung dari received date sampai hari ini.

### AG-003 Submitted Aging

Jika submitted date terisi tetapi final status belum Completed, aging dihitung dari submitted date sampai hari ini.

### AG-004 Dashboard Alert

Document aging yang melewati threshold harus tampil di dashboard.

Threshold dapat dibuat configurable per document type.

## 6. Export Document Group

### 6.1 Pre-loading

Documents:

- Contract,
- FCO/MoM,
- SI,
- LC if applicable,
- VesNom,
- Stowage Plan.

Owner:

- Commercial docs: Forecast Sales/Sales.
- SI and operation docs: Shipment Monitor.

### 6.2 Loading and Sailing

Documents:

- NOR POL,
- BL/CM,
- PEB,
- LHV,
- Surveyor LS,
- royalty/supporting docs.

Owner:

- Sales/Traffic.

### 6.3 POD and Quality

Documents:

- NOR POD,
- COA POL,
- COA POD,
- discharge report,
- final quantity report.

Owner:

- POD operation docs: Sales/Traffic.
- COA docs: Quality.

### 6.4 Finance / Payment

Documents:

- full set docs,
- invoice,
- payment due date reference,
- received payment proof.

Owner:

- Outstanding Payment / Finance support.

## 7. Domestic Document Handover

Domestic shipments require document handover tracking, not only upload.

### 7.1 Main Documents

- PO No.
- Contract No.
- SKAB-SK
- DSR Carbon
- BL/CM
- COA POL
- COA POD
- Time Sertif
- Terpal
- Insurance
- Invoice
- POD report
- Weightbridge report
- Full set docs
- Hardcopy
- Softcopy

### 7.2 SKAB-SK Flow

Flow:

Supplier -> Operation -> Traffic -> Finance

Fields:

- supplier sent date,
- operation received date,
- operation sent date,
- traffic received date,
- traffic sent to finance date,
- finance received date,
- aging per step,
- evidence upload,
- notes.

### 7.3 DSR Carbon Flow

Flow:

Supplier -> Operation -> Traffic

Fields:

- supplier sent date,
- operation received date,
- operation sent date,
- traffic received date,
- aging,
- evidence upload.

### 7.4 BL/CM Flow

Flow:

Operation -> Traffic -> Finance

Fields:

- BL date,
- operation sent date,
- traffic received date,
- traffic sent to finance date,
- finance received date,
- aging,
- upload.

### 7.5 COA POL Flow

Flow:

Surveyor -> Traffic -> Finance

Fields:

- COA date,
- surveyor sent date,
- traffic received date,
- finance received date,
- aging,
- upload.

### 7.6 COA POD / Final Docs

Fields:

- COA POD received date,
- finance submit full set docs,
- received by vendor,
- approval DT date,
- paid to vendor date,
- aging.

## 8. Upload Rules

### UP-001 Multiple Files

Tiap document type dapat memiliki lebih dari satu file.

### UP-002 Allowed File Types

Allowed:

- PDF,
- DOCX,
- XLSX where relevant,
- image formats for evidence such as PNG/JPG/JPEG/WebP.

### UP-003 File Metadata

Setiap file harus menyimpan:

- original file name,
- file type,
- file size,
- storage provider,
- storage key/object path,
- storage URL/reference if external storage is used,
- uploaded by,
- uploaded at,
- document title,
- document group,
- status.

### UP-005 Production Storage

Untuk production, file upload harus dapat disimpan di object storage durable, bukan hanya temporary local filesystem.

Implementation requirement:

- Sistem boleh memakai database bytes sebagai fallback/testing mode.
- Sistem production harus mendukung object storage seperti Supabase Storage.
- Metadata storage wajib tetap tersimpan di database agar permission, audit, checklist, ZIP download, dan legacy download route tetap memakai access control aplikasi.
- Existing DB-backed documents tetap harus bisa dibaca setelah object storage diaktifkan.

### UP-004 Delete and Replace

Delete file harus soft-delete jika file sudah dipakai dalam audit/revision. Replace harus membuat file version baru jika document critical.

## 9. Closing Blockers

Shipment tidak boleh closed jika:

- required shipment docs belum Completed atau Not Required,
- required quality docs belum tersedia,
- required payment docs belum clear sesuai rule,
- SI status masih pending approval,
- source/barge/SI revision masih pending,
- issue evidence/reason belum lengkap.

## 10. Acceptance Criteria

1. User tahu upload dokumen di module mana.
2. Shipment Monitor dapat menampilkan linked document dari module lain.
3. Document aging dihitung otomatis.
4. Dashboard menampilkan pending/aging docs.
5. Domestic handover dapat menunjukkan dokumen nyangkut di pihak mana.
6. Closing validation membaca status dokumen.
7. Upload/download tetap berjalan untuk file lama di database dan file baru di object storage.
