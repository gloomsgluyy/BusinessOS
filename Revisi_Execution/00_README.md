# Revisi Execution

Folder ini adalah control room eksekusi revisi CoalTrade OS.

Ada dua sistem dokumentasi yang harus selalu berjalan bersama:

1. `SRS_CoalTrade_OS_Revisi`
   - Berisi target produk, requirement final, business rule, acceptance criteria, dan traceability.
   - SRS menjawab: sistem harus menjadi apa?

2. `Revisi_Execution`
   - Berisi guide kerja AI/developer, gap code-vs-SRS, backlog eksekusi, status implementasi, decision log, dan implementation log.
   - Execution menjawab: dari code sekarang, apa yang sudah ada, apa yang belum, apa yang sedang dikerjakan, dan bagaimana mencegah pekerjaan lama tertimpa?

## Prinsip Utama

1. SRS adalah kontrak produk.
2. Revisi Execution adalah ledger pengerjaan.
3. Code adalah bukti implementasi.
4. AI tidak boleh menganggap suatu requirement selesai hanya karena ada nama menu atau file.
5. AI wajib membandingkan behavior code dengan SRS sebelum mengubah code.
6. AI wajib update dokumen execution setelah perubahan signifikan.
7. Jika revisi user mengubah scope produk, AI wajib update SRS dan Revisi Execution.
8. Jika fitur sudah selesai, AI harus menjaga dan mengembangkan fitur itu, bukan menimpa ulang dari nol.

## Struktur File

| File | Fungsi |
|---|---|
| `01_AI_Working_Protocol.md` | Aturan kerja wajib untuk AI sebelum, saat, dan setelah implementasi. |
| `02_Current_Code_vs_SRS_Gap.md` | Snapshot gap analysis code sekarang terhadap SRS. |
| `03_Execution_Backlog.md` | Backlog prioritas eksekusi, urutan kerja, dan definition of done. |
| `04_Module_Implementation_Status.md` | Status implementasi per modul, evidence code, dan gap utama. |
| `05_Decision_Log.md` | Catatan keputusan produk/teknis agar tidak berubah-ubah tanpa alasan. |
| `06_Implementation_Log.md` | Log pekerjaan yang sudah dilakukan, file terdampak, verifikasi, dan sisa risiko. |
| `07_No_Overwrite_Checklist.md` | Checklist anti-overwrite sebelum edit code. |

## Cara Pakai Untuk AI

Sebelum mulai coding:

1. Baca `SRS_CoalTrade_OS_Revisi/00_README.md`.
2. Baca `SRS_CoalTrade_OS_Revisi/06_Traceability_Matrix.md`.
3. Baca file SRS yang relevan dengan request user.
4. Baca `Revisi_Execution/01_AI_Working_Protocol.md`.
5. Baca `Revisi_Execution/02_Current_Code_vs_SRS_Gap.md`.
6. Baca `Revisi_Execution/03_Execution_Backlog.md`.
7. Cek code sekarang dengan `rg` dan file terkait.
8. Baru implementasi.

Setelah coding:

1. Update status task di `03_Execution_Backlog.md`.
2. Update status modul di `04_Module_Implementation_Status.md` jika berubah.
3. Tambahkan entry di `06_Implementation_Log.md`.
4. Jika ada keputusan baru, update `05_Decision_Log.md`.
5. Jika scope/requirement berubah, update SRS terkait.

## Snapshot Saat Dibuat

Tanggal: 2026-05-23

Branch: `deploy-main-shipment-docs`

Kondisi penting:

- SRS baru sudah ada di `SRS_CoalTrade_OS_Revisi`.
- SRS sudah mencakup revisi Forecast Sales + FCO.
- Code sudah memiliki banyak modul dasar, tetapi belum memenuhi semua workflow production-grade.
- Fitur dokumen shipment sudah cukup maju untuk upload/download testing.
- Traceability besar seperti Source Change, Barge Change, SI versioning, FCO approval, dan Forecast Sales baru belum fully implemented.
