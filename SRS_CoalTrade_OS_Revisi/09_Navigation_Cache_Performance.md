# SRS 09 - Navigation Cache & Sync Performance

## Context

Setelah skeleton loader dikembalikan, muncul regresi UX: setelah data berhasil load sekali, perpindahan antar modul tetap terasa seperti load ulang. Analisis code menunjukkan penyebab utama bukan hanya Supabase atau skeleton, tetapi pola sync client yang terlalu agresif.

## Root Cause

1. `AppShell` menjalankan auto sync saat status auth aktif dan sebelumnya ikut re-run saat `pathname` berubah.
2. Banyak halaman menjalankan `syncFromMemory()` pada `useEffect` mount.
3. Commercial store hanya menahan sync selama 5 detik, sehingga navigasi antar modul setelah beberapa detik bisa memicu fetch penuh ulang.
4. Dashboard sebelumnya memanggil `syncCommercial(..., { force: true })` setiap mount, sehingga selalu bypass cache.
5. `dashboard_fast` dan `full` sync belum dibedakan secara jelas, sehingga data cepat dashboard dapat tercampur dengan status fresh untuk data modul lain.

## Functional Requirements

| ID | Priority | Requirement |
|---|---|---|
| FR-PERF-001 | P0 | Setelah successful sync pertama, pindah modul tidak boleh memicu full sync ulang selama cache masih fresh. |
| FR-PERF-002 | P0 | `AppShell` tidak boleh menjalankan immediate sync hanya karena route/pathname berubah. |
| FR-PERF-003 | P0 | Dashboard tidak boleh menggunakan `force: true` untuk sync otomatis reguler. Force hanya untuk manual refresh atau mutasi yang memang perlu fetch ulang. |
| FR-PERF-004 | P0 | Store sync harus punya in-flight guard supaya request yang sama tidak berjalan paralel. |
| FR-PERF-005 | P0 | Store sync harus punya warm-cache TTL minimal 60 detik untuk navigasi normal. |
| FR-PERF-006 | P1 | Commercial store wajib membedakan `lastSyncTime` umum dan `lastFullSyncTime`, agar `dashboard_fast` tidak dianggap sebagai full module refresh. |
| FR-PERF-007 | P1 | Manual refresh/sync button wajib bypass cache dengan `force: true`. |
| FR-PERF-008 | P1 | Mutasi penting yang membaca ulang server state setelah update/delete boleh menggunakan `force: true`. |
| FR-PERF-009 | P1 | Skeleton hanya tampil untuk cold load saat module belum punya primary data; warm navigation harus render data cache terlebih dahulu sambil sync background bila stale. |

## Acceptance Criteria

1. User membuka aplikasi, data berhasil load, lalu pindah dari Forecast Sales ke Shipment Monitor dan kembali lagi dalam 60 detik: modul harus render dari cache tanpa full-screen reload.
2. Perpindahan route tidak membuat `AppShell` membuat interval/effect baru yang langsung memicu global sync.
3. Dashboard mount ulang tidak memaksa full commercial sync jika data masih fresh.
4. Jika user menekan manual sync, semua store tetap fetch ulang dari server walaupun cache masih fresh.
5. Jika mutation penting selesai dan butuh server truth, kode menggunakan `force: true`.
6. Jika data kosong pada cold load, skeleton tetap tampil sampai primary data masuk atau sync selesai.

## Non-Goals

1. Tidak mengganti database.
2. Tidak menghapus skeleton loader.
3. Tidak mengubah flow approval, document drive, SI, FCO, atau SRS module lain.
4. Tidak membuat realtime subscription pada revisi ini.

## Implementation Notes

Recommended implementation:

- Set warm TTL client sync minimal `60_000 ms`.
- Keep persisted local store data as first render source.
- Use in-flight promise guard per store.
- Remove route/pathname as trigger dependency for AppShell auto sync.
- Keep route-level `syncFromMemory()` calls safe by making store cache-aware.
- Track `lastFullSyncTime` in commercial store so `dashboard_fast` does not mask a missing full sync.

