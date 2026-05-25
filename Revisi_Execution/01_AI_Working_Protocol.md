# AI Working Protocol

Dokumen ini wajib dibaca AI sebelum mengerjakan revisi code CoalTrade OS.

## 1. Source of Truth

Urutan source of truth:

1. Pesan user terbaru.
2. `SRS_CoalTrade_OS_Revisi`.
3. `Revisi_Execution`.
4. Code saat ini.
5. Historical docs/PDF/XLSX yang disebut user.

Jika pesan user terbaru bertentangan dengan SRS:

- Ikuti pesan user terbaru.
- Update SRS agar requirement baru tercatat.
- Update Revisi Execution agar backlog dan gap analysis ikut berubah.

Jika code sudah berbeda dari Revisi Execution:

- Percaya code setelah diverifikasi.
- Update Revisi Execution agar tidak misleading.

## 2. Mandatory Start Checklist

Sebelum edit code, AI wajib:

1. Jalankan `git status --short --branch`.
2. Baca file SRS yang relevan.
3. Baca file Revisi Execution yang relevan.
4. Cari implementasi existing dengan `rg`.
5. Identifikasi file yang akan disentuh.
6. Identifikasi fitur yang sudah selesai dan tidak boleh rusak.
7. Tentukan apakah request adalah:
   - documentation only,
   - SRS update,
   - execution planning,
   - implementation,
   - bugfix,
   - verification/deploy.

## 3. Mandatory End Checklist

Setelah edit code atau dokumen:

1. Jelaskan apa yang berubah.
2. Jalankan verifikasi yang masuk akal.
3. Update `03_Execution_Backlog.md` jika task berubah status.
4. Update `04_Module_Implementation_Status.md` jika status modul berubah.
5. Tambah entry di `06_Implementation_Log.md`.
6. Update SRS jika ada requirement baru.
7. Jangan commit/push kecuali user meminta.

## 4. No Overwrite Rules

AI tidak boleh:

- Menghapus fitur yang sudah berjalan hanya karena ingin membuat ulang.
- Mengubah konsep owner module tanpa update SRS dan execution docs.
- Menghapus field lama tanpa migrasi/backward compatibility.
- Menghapus upload/download dokumen shipment yang sudah ada.
- Menghapus SI/summary PDF project yang sudah ada sebelum pengganti siap.
- Menghapus route lama yang masih dipakai UI.
- Mengganti model data utama tanpa migration plan.

AI harus:

- Membaca file existing sebelum mengedit.
- Menjaga compatibility dengan data lama.
- Membedakan rename product-facing vs rename database.
- Menambahkan adapter/mapping jika perlu.
- Mencatat perubahan behavior di implementation log.

## 5. Documentation Update Rules

### Update SRS Jika

- User menambahkan requirement baru.
- Ada perubahan business flow.
- Ada perubahan owner module.
- Ada perubahan role/approval/audit.
- Ada perubahan output dokumen seperti SI/FCO/Summary.
- Ada perubahan definition of done.

### Update Revisi Execution Jika

- Ada implementasi selesai.
- Ada gap baru ditemukan.
- Ada bug/risiko yang harus diingat.
- Ada keputusan produk/teknis.
- Ada perubahan prioritas.
- Ada file/code path yang menjadi evidence.

## 6. Evidence Rule

Setiap item yang ditandai Done harus punya evidence:

- file path code,
- route/API path jika ada,
- model/database field jika ada,
- UI page/component jika ada,
- test/build/manual verification,
- known limitation jika masih ada.

Tidak boleh menandai Done hanya karena:

- menu ada,
- nama model ada,
- field ada tapi tidak dipakai workflow,
- UI mock ada tapi tidak persist,
- data dummy ada.

## 7. Recommended Working Flow

Untuk setiap task implementasi:

1. Ambil requirement ID dari SRS.
2. Baca current status di `04_Module_Implementation_Status.md`.
3. Cari code existing.
4. Tentukan minimal patch yang memenuhi acceptance criteria.
5. Update code.
6. Verifikasi.
7. Update execution docs.
8. Final response ke user.

## 8. Naming Policy

Untuk revisi 2026-05-23:

- Product-facing label: `Forecast Sales`.
- Legacy/internal boleh masih memakai `ProjectItem`, `projects`, atau `/projects` sementara.
- Jika UI masih memakai `Projects`, itu dianggap gap sampai rename product-facing selesai.
- Migration bertahap lebih aman daripada rename database langsung.

## 9. Priority Policy

Prioritas tertinggi:

1. Forecast Sales + FCO workflow.
2. Shipment Monitor workflow/sub-tabs and data completeness.
3. Document Checklist with aging.
4. Source Change Traceability.
5. Barge Change Log.
6. SI Management versioning/approval.
7. Approval Center and Audit Trail.
8. Quality Comparison.
9. Finance/P&L integration.
10. Dashboard control tower.
