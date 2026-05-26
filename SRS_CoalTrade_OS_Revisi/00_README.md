# CoalTrade OS Revision SRS

Dokumen ini adalah paket SRS baru untuk finalisasi CoalTrade OS berdasarkan 3 dokumen revisi:

1. `CoalTrade_OS_System_Flow_Requirement.docx`
2. `CoalTrade_OS_Module_Revision_Matrix.xlsx`
3. `CoalTrade_OS_Module_Revision_Matrix_SIMPLE.xlsx`

Tujuan folder ini adalah menyediakan acuan implementasi yang lebih detail, terstruktur, dan traceable. Seluruh requirement utama dari 3 dokumen revisi wajib dipenuhi oleh implementasi final.

## Companion Execution Folder

Folder ini harus dibaca bersama `Revisi_Execution`.

- `SRS_CoalTrade_OS_Revisi` adalah kontrak requirement produk.
- `Revisi_Execution` adalah ledger eksekusi AI/developer: gap code-vs-SRS, backlog, status implementasi, decision log, implementation log, dan checklist anti-overwrite.

Jika ada revisi baru dari user, AI wajib:

1. Update SRS jika requirement berubah.
2. Update `Revisi_Execution` jika status/gap/backlog berubah.
3. Cek code sekarang sebelum mengubah implementasi.
4. Menjaga fitur yang sudah selesai agar tidak tertimpa.

## Struktur Dokumen

| File | Isi |
|---|---|
| `01_SRS_Master.md` | Visi sistem, scope, prinsip utama, role, workflow end-to-end, asumsi, dan definisi utama. |
| `02_Functional_Requirements.md` | Daftar functional requirements dengan ID, prioritas, rule, dan acceptance criteria. |
| `03_Module_Requirements.md` | Detail kebutuhan per modul: Dashboard, Forecast Sales, Sales, Shipment, Source, Quality, SI, Payment, P&L, dan lainnya. |
| `04_Document_Management.md` | Aturan upload/input dokumen, document ownership, checklist, aging, domestic handover, dan closing blocker. |
| `05_Roles_Status_Approval_Audit.md` | Role ownership, status flow, approval center, audit trail, dan closing validation. |
| `06_Traceability_Matrix.md` | Mapping requirement SRS ke isi 3 dokumen revisi agar tidak ada revisi yang hilang. |
| `07_Implementation_Roadmap_Acceptance.md` | Roadmap phase, priority, deliverable, dan acceptance test per phase. |
| `08_Forecast_Sales_FCO_Revision.md` | Revisi lisan terbaru: rename Projects menjadi Forecast Sales, offer workflow, supplier candidate, blending, FCO generator, buyer feedback, rough P&L restricted, dan shipment data completeness. |
| `09_Navigation_Cache_Performance.md` | Revisi performance: warm cache, route navigation sync guard, full-vs-fast commercial sync, dan acceptance criteria skeleton/cache. |

## Prinsip Wajib

1. Sistem tidak boleh lagi terasa seperti tabel Excel panjang.
2. Setiap data penting harus punya owner modul dan owner role.
3. Modul lama Projects harus diperlakukan sebagai Forecast Sales.
4. FCO tidak boleh didownload atau dikirim sebelum approval CEO/management sesuai rule.
5. Source change, barge change, SI revision, harga offer, dan laycan revision tidak boleh overwrite data lama.
6. Dokumen harus punya status, tanggal, aging, upload, owner, dan blocker rule.
7. Shipment tidak boleh closed kalau mandatory data belum lengkap.
8. Dashboard harus alert-based, bukan hanya angka umum.
9. P&L harus semakin otomatis menarik data dari shipment, source, freight, payment, dan expenses.
10. Approval dan audit trail wajib untuk perubahan berisiko tinggi.

## Cara Pakai

Gunakan folder ini sebagai kontrak kerja revisi production-grade:

- Product owner membaca `01_SRS_Master.md` untuk memastikan arah sistem benar.
- Developer membaca `02_Functional_Requirements.md` dan `03_Module_Requirements.md` untuk implementasi.
- QA membaca acceptance criteria di tiap file dan `07_Implementation_Roadmap_Acceptance.md`.
- Auditor/management membaca `06_Traceability_Matrix.md` untuk memastikan 3 dokumen revisi sudah ter-cover.
- AI/developer membaca `../Revisi_Execution/01_AI_Working_Protocol.md` sebelum coding.

## Status Dokumen

Version: `v1.2`

Created from revision documents dated: `2026-05-22`

Latest oral/performance revision added: `2026-05-26`

Implementation status: belum otomatis berarti sistem sudah memenuhi semua requirement. Folder ini adalah acuan finalisasi dan gap analysis.
