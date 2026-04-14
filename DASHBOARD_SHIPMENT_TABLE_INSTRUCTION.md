# Instruksi: Pemisahan Tabel Shipment di Dashboard

## Konteks

Di halaman **Dashboard** (`src/app/page.tsx`), section shipment saat ini menampilkan semua data dalam bentuk list card (`ShipmentTimeline`) yang dicampur antara Lokal dan Export, tanpa pemisahan jelas.

Tujuan perubahan ini:
1. **Pisahkan** shipment Lokal (`type = "local"`) dan Export (`type = "export"`) ke dalam **dua tabel terpisah**.
2. Dalam setiap tabel, tampilkan **breakdown berdasarkan status** agar lebih mudah dibaca.

---

## Struktur Data yang Relevan

### Field `type` pada Shipment
| Nilai | Label |
|-------|-------|
| `"local"` | Lokal / Domestik |
| `"export"` | Export |

### Field `status` pada Shipment (dari `SHIPMENT_STATUSES` di `src/lib/constants.ts`)
| Nilai | Label | Keterangan |
|-------|-------|------------|
| `"upcoming"` | Upcoming | Akan datang |
| `"loading"` | Loading | Sedang proses muat |
| `"in_transit"` | In Transit | Dalam perjalanan |
| `"done_shipment"` | Done Shipment | Muat selesai |
| `"completed"` | Completed | Selesai |
| `"cancelled"` | Cancelled | Dibatalkan |

---

## Perubahan yang Harus Dilakukan

### 1. Ganti `ShipmentTimeline` menjadi `ShipmentTable`

Buat komponen baru bernama `ShipmentTable` untuk menampilkan shipment dalam format **tabel**, bukan list card.

#### Kolom Tabel
| No | Kolom | Field |
|----|-------|-------|
| 1 | No | (index) |
| 2 | Shipment No | `shipment_number` |
| 3 | Buyer | `buyer` |
| 4 | Vessel / Barge | `vessel_name` atau `barge_name` |
| 5 | Port Muat | `loading_port` |
| 6 | Qty (MT) | `quantity_loaded` atau `qty_plan` |
| 7 | BL Date | `bl_date` |
| 8 | Status | `status` (tampilkan sebagai badge berwarna) |

#### Contoh signature komponen
```tsx
function ShipmentTable({
  shipments,
  label,
  emptyText,
}: {
  shipments: any[];
  label: string;
  emptyText?: string;
}) { ... }
```

---

### 2. Pisahkan Data Berdasarkan `type`

Di dalam `DashboardPage`, tambahkan dua variabel turunan dari `filteredShipments`:

```ts
const lokalShipments = filteredShipments.filter(sh => sh.type === "local");
const exportShipments = filteredShipments.filter(sh => sh.type === "export");
```

---

### 3. Breakdown per Status (Tabel per Type)

Setiap tabel (Lokal dan Export) **diurutkan berdasarkan status**, dan bisa juga diberi **badge jumlah per status** di header tabel.

Contoh summary badge di atas tabel:

```
[Upcoming: 3]  [Loading: 2]  [In Transit: 5]  [Completed: 10]  [Cancelled: 1]
```

Implementasi summary:
```ts
const statusSummary = (list: any[]) =>
  SHIPMENT_STATUSES.map(s => ({
    ...s,
    count: list.filter(sh => sh.status === s.value).length,
  })).filter(s => s.count > 0);
```

---

### 4. Layout di Dashboard (Ganti Row 5)

Ganti Row 5 yang lama:
```tsx
{/* Row 5: Shipment Timelines (3 sections) */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <ShipmentTimeline shipmentItems={onGoingShipments} label="On-going Shipments" />
    <ShipmentTimeline shipmentItems={upcoming30} label="Upcoming (30 Days)" />
    <ShipmentTimeline shipmentItems={upcoming60} label="Upcoming (60 Days)" />
</div>
```

Menjadi:
```tsx
{/* Shipment Lokal */}
<ShipmentTable
  shipments={lokalShipments}
  label="Shipment Lokal (Domestik)"
  emptyText="Tidak ada shipment lokal"
/>

{/* Shipment Export */}
<ShipmentTable
  shipments={exportShipments}
  label="Shipment Export"
  emptyText="Tidak ada shipment export"
/>
```

---

### 5. Sorting Default

Urutkan baris tabel berdasarkan **status** dengan urutan berikut (prioritas operasional):

```
loading → in_transit → upcoming → done_shipment → completed → cancelled
```

Implementasi:
```ts
const STATUS_ORDER = ["loading", "in_transit", "upcoming", "done_shipment", "completed", "cancelled"];

const sorted = [...shipments].sort(
  (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
);
```

---

## Ringkasan Perubahan

| File | Aksi | Detail |
|------|------|--------|
| `src/app/page.tsx` | MODIFY | Tambah komponen `ShipmentTable`, ganti Row 5, tambah variabel `lokalShipments` & `exportShipments` |

---

## Hasil Akhir yang Diharapkan

Dashboard akan memiliki dua tabel terpisah:

### Tabel 1 — Shipment Lokal (Domestik)
| Status Badge Summary | Upcoming: N | Loading: N | In Transit: N | ... |
|----------------------|-------------|------------|---------------|-----|

| No | Shipment No | Buyer | Vessel/Barge | Port Muat | Qty (MT) | BL Date | Status |
|----|-------------|-------|--------------|-----------|----------|---------|--------|
| 1  | SH-2025-001 | PT ABC | MV Cahaya | Satui | 10.000 | 01 Jan 2025 | 🔵 Loading |
| ...| ...         | ...   | ...          | ...       | ...      | ...     | ...    |

### Tabel 2 — Shipment Export
| Status Badge Summary | Upcoming: N | In Transit: N | Completed: N | ... |
|----------------------|-------------|---------------|--------------|-----|

| No | Shipment No | Buyer | Vessel/Barge | Port Muat | Qty (MT) | BL Date | Status |
|----|-------------|-------|--------------|-----------|----------|---------|--------|
| 1  | SH-2025-042 | Korea Inc | MV Eagle | Taboneo | 50.000 | 15 Feb 2025 | 🟣 In Transit |
| ...| ...         | ...   | ...          | ...       | ...      | ...     | ...    |
