# Instruksi Implementasi
## Penambahan Alasan untuk On-Going Shipment Pending + Pagination Semua Halaman

## 1. Tujuan
Dokumen ini menjelaskan langkah implementasi untuk:
1. Menambahkan alasan (reason) pada shipment yang masih on-going dan berstatus pending/waiting.
2. Menambahkan pagination secara konsisten di semua halaman yang menampilkan list data.

## 2. Kondisi Saat Ini (Ringkas)
- `ShipmentDetail` di Prisma belum memiliki kolom khusus reason yang tersimpan permanen.
- Di UI dan type sudah ada `status_reason` dan `pending_items`, tetapi reason saat ini lebih banyak hasil derive dari `issueNotes/remarks` di API shipment.
- Endpoint list (`/api/memory/*`) umumnya masih `findMany` tanpa `page/pageSize`.
- Halaman list data masih render semua data (atau di-hardcode `slice`) tanpa kontrol pagination standar.

## 3. Scope Perubahan
- Database: `prisma/schema.prisma`, migration Prisma.
- API shipment: `src/app/api/memory/shipments/route.ts`.
- Store shipment: `src/store/commercial-store.ts`.
- UI shipment monitor: `src/app/shipment-monitor/page.tsx`.
- Pagination shared: `src/lib/*`, `src/hooks/*`, `src/components/*`.
- Semua endpoint list API memory (`src/app/api/memory/**/route.ts`).
- Semua halaman list utama (`src/app/**/page.tsx`).

## 4. Fitur A - Alasan untuk On-Going Shipment Pending

### 4.1 Tambah kolom reason di database
Di `model ShipmentDetail` pada `prisma/schema.prisma`, tambahkan:

```prisma
statusReason String? @db.Text
```

Lalu generate migration:

```bash
npx prisma migrate dev --name add_shipment_status_reason
npx prisma generate
```

### 4.2 Update API shipment agar reason bisa ditulis dan dibaca
File: `src/app/api/memory/shipments/route.ts`

Perubahan yang wajib:
1. `GET`:
- Sertakan `statusReason` dari DB pada hasil response.
- Prioritas reason:
  - `statusReason` dari DB (manual input user)
  - fallback `deriveStatusReason(...)`
- `pendingItems` tetap bisa di-derive, tetapi jangan menimpa `statusReason` manual.

2. `POST` dan `PUT`:
- Terima payload `statusReason`.
- Simpan ke kolom `statusReason`.
- Support dua format key untuk kompatibilitas:
  - `statusReason` (camelCase)
  - `status_reason` (snake_case)

3. Rule rekomendasi (server-side validation ringan):
- Untuk status on-going (`upcoming`, `loading`, `in_transit`) yang pending/waiting, jika reason kosong maka set default:
  - `"Waiting operational readiness."`
- Reason maksimal 500 karakter (truncate/validasi).

### 4.3 Update store shipment
File: `src/store/commercial-store.ts`

Perubahan wajib:
1. Saat `addShipment`, kirim `status_reason` -> `statusReason` ke API.
2. Saat `updateShipment`, map `u.status_reason` ke body `statusReason`.
3. Saat mapping response API -> state, pastikan `status_reason: ship.statusReason` selalu terisi jika ada.

### 4.4 Update UI Shipment Monitor
File: `src/app/shipment-monitor/page.tsx`

Perubahan wajib:
1. Tambahkan input `Status Reason` (textarea lebih baik daripada input text) pada modal edit/create shipment.
2. Wajib isi reason jika kondisi berikut terpenuhi:
- status termasuk on-going (`upcoming`, `loading`, `in_transit`), dan
- shipment mengandung indikasi pending/waiting (mis. ada `pending_items`, atau `shipment_status` mengandung kata `pending/waiting`).

3. Tampilkan reason di area yang mudah terlihat pada daftar on-going:
- Card view: tampilkan snippet 1-2 baris di bawah status badge.
- Table view: tambahkan kolom `Pending Reason` (truncate + tooltip/full text di expand).

4. Pertahankan area detail modal yang sudah menampilkan:
- `status_reason`
- fallback ke `issue_notes`

### 4.5 Acceptance criteria Fitur A
- User dapat mengisi reason manual saat edit/create shipment.
- Reason tersimpan di DB dan tidak hilang setelah refresh.
- Reason tampil di list on-going dan detail modal.
- Jika shipment on-going pending tanpa reason, UI memberi warning/validation.

## 5. Fitur B - Pagination Semua Halaman

## 5.1 Standarisasi kontrak pagination (API)
Gunakan query params standar di semua endpoint list:
- `page` (default `1`)
- `pageSize` (default `20`)
- `search` (opsional)
- `sortBy` (opsional)
- `sortOrder` (`asc|desc`, default `desc`)

Format response standar:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 243,
    "totalPages": 13,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

Catatan kompatibilitas:
- Tetap support response lama sementara (mis. `shipments`, `tasks`) selama masa transisi.
- Setelah semua halaman pindah ke format baru, baru rapikan response lama.

## 5.2 Buat util reusable pagination
Tambahkan utility reusable, contoh:
- `src/lib/pagination.ts`
- `src/hooks/use-pagination.ts`
- `src/components/shared/pagination-controls.tsx`

Isi minimal:
1. Parser query (`page`, `pageSize`) + safe bounds.
2. Prisma helper (`skip`, `take`).
3. Builder metadata (`totalPages`, `hasNextPage`, dll).
4. Komponen UI tombol: First, Prev, Next, Last + page size selector.

## 5.3 Terapkan ke semua endpoint list API memory
Target minimal endpoint:
- `src/app/api/memory/tasks/route.ts`
- `src/app/api/memory/projects/route.ts`
- `src/app/api/memory/shipments/route.ts`
- `src/app/api/memory/sources/route.ts`
- `src/app/api/memory/quality/route.ts`
- `src/app/api/memory/market-prices/route.ts`
- `src/app/api/memory/meetings/route.ts`
- `src/app/api/memory/sales-orders/route.ts`
- `src/app/api/memory/sales-deals/route.ts`
- `src/app/api/memory/purchases/route.ts`
- `src/app/api/memory/outstanding-payment/route.ts`
- `src/app/api/memory/blending/route.ts`
- `src/app/api/memory/pl-forecasts/route.ts`
- `src/app/api/memory/partners/route.ts`
- `src/app/api/memory/daily-delivery/route.ts`

Implementasi teknis tiap endpoint:
1. Hitung `totalItems` dengan `count`.
2. Gunakan `skip` + `take` pada `findMany`.
3. Kembalikan `meta`.

## 5.4 Terapkan ke halaman frontend yang punya list data
Prioritas halaman (wajib):
- `src/app/shipment-monitor/page.tsx`
- `src/app/transshipment/page.tsx`
- `src/app/sources/page.tsx`
- `src/app/meetings/page.tsx`
- `src/app/sales-orders/page.tsx`
- `src/app/purchase-requests/page.tsx`
- `src/app/outstanding-payment/page.tsx`
- `src/app/quality/page.tsx`
- `src/app/projects/page.tsx`
- `src/app/sales-monitor/page.tsx`
- `src/app/approval-inbox/page.tsx`
- `src/app/all-tasks/page.tsx`
- `src/app/my-tasks/page.tsx`
- `src/app/users/page.tsx`
- `src/app/market-price/page.tsx` (table/list section)

Panduan implementasi frontend:
1. Simpan state: `page`, `pageSize`, `totalPages`, `totalItems`.
2. Trigger fetch ulang saat page/filter/sort berubah.
3. Reset ke page 1 saat filter/search berubah.
4. Sinkronkan `page` dan `pageSize` ke URL query untuk deep-link.
5. Render loading/skeleton saat page berpindah.
6. Pastikan mobile-friendly (pagination tidak overflow).

## 5.5 Rule UX Pagination
- Default `pageSize = 20`.
- Opsi page size: `10, 20, 50, 100`.
- Jika hasil filter kosong, tampilkan empty state + reset filter CTA.
- Setelah delete item di page terakhir, auto fallback ke page sebelumnya jika page saat ini jadi kosong.

## 6. Testing Checklist

### 6.1 Shipment reason
1. Buat shipment on-going pending, isi reason, simpan.
2. Refresh halaman, reason tetap ada.
3. Edit reason, simpan, pastikan nilai terbaru tampil.
4. Coba simpan on-going pending tanpa reason, validasi muncul.

### 6.2 Pagination
1. Setiap endpoint mengembalikan `meta` dengan nilai benar.
2. Pindah page tidak duplikasi atau loncat data.
3. Filter + pagination bekerja bersamaan.
4. Sort + pagination bekerja konsisten.
5. Ubah pageSize mereset ke page 1.

### 6.3 Regression
1. `npm run build` harus sukses.
2. Cek modul yang memakai store yang sama tidak rusak.
3. Cek export/report masih jalan.

## 7. Rencana Eksekusi (Disarankan)
1. PR-1: Database + API shipment reason.
2. PR-2: UI shipment reason + validasi form.
3. PR-3: Shared pagination helper + 3 endpoint utama (shipments, tasks, projects).
4. PR-4: Rollout pagination ke endpoint dan halaman lainnya.
5. PR-5: Hardening + regression test + cleanup response legacy.

## 8. Definition of Done
- Reason pending pada on-going shipment dapat diinput manual, tersimpan di DB, tampil konsisten di list dan detail.
- Semua halaman list utama memiliki pagination aktif dengan UX seragam.
- Semua endpoint list utama sudah mendukung `page/pageSize` dan return `meta`.
- Build production berhasil tanpa error.
