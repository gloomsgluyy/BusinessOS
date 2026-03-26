# Patch Notes: P&L Forecast Sync Fix

## Problem
Ketika data di Google Sheets (tab "P&L Forecast") diedit, perubahan tidak terlihat di aplikasi meskipun proses sync background sudah berjalan.

## Root Cause
API endpoint `/api/memory/pl-forecasts` (GET) hanya membaca dari database cache tanpa melakukan sync dari Google Sheets terlebih dahulu. Padahal sistem menggunakan "Sheets-First Architecture" dimana Google Sheets adalah source of truth.

## Solution

### 1. Tambah Method Sync dari Sheets
**File:** `src/lib/sheets-first-service.ts`

Menambahkan method baru `syncPLForecastsFromSheet()` yang:
- Membaca semua data dari Google Sheets tab "P&L Forecast"
- Melakukan upsert ke database untuk setiap record
- Menghitung ulang gross profit dan total gross profit
- Menandai record yang tidak ada di Sheet sebagai deleted
- Menjaga konsistensi data antara Sheets dan Database

### 2. Update API GET Endpoint
**File:** `src/app/api/memory/pl-forecasts/route.ts`

Mengubah endpoint GET untuk:
- Mendeteksi parameter `sync` atau `t` di query string
- Memanggil `syncPLForecastsFromSheet()` sebelum membaca data
- Mengembalikan data terbaru dari database setelah sync

### 3. Tambah UI Sync Manual
**File:** `src/app/pl-forecast/client.tsx`

Menambahkan:
- Tombol "Sync" di header halaman dengan icon refresh
- State `isSyncing` untuk tracking proses sync
- Handler `handleManualSync()` untuk trigger sync manual
- Animasi spinning saat sedang sync
- Toast notification untuk feedback ke user

## How It Works

### Automatic Sync
- Background sync berjalan setiap 30 detik via `AutoSyncListener` di `app-shell.tsx`
- Memanggil `syncFromMemory()` yang akan fetch data dengan parameter `?t=${timestamp}`
- Parameter `t` akan trigger sync dari Sheets di API endpoint
- Data akan ter-update otomatis maksimal dalam 30 detik

### Manual Sync
- User dapat menekan tombol "Sync" kapan saja
- Akan segera fetch data terbaru dari Google Sheets
- Menampilkan loading state dan notifikasi hasil sync

## Data Flow

```
Google Sheets (Source of Truth)
    ↓
    ↓ (Background Sync setiap 30s OR Manual Sync)
    ↓
Database Cache (Fast Read)
    ↓
    ↓ (API: /api/memory/pl-forecasts?t=...)
    ↓
Zustand Store (Frontend State)
    ↓
    ↓ (React Render)
    ↓
UI Display
```

## Testing

1. **Test Manual Sync:**
   - Buka halaman P&L Forecast
   - Edit data di Google Sheets
   - Klik tombol "Sync" di aplikasi
   - Verifikasi data berubah sesuai dengan Sheets

2. **Test Automatic Sync:**
   - Buka halaman P&L Forecast
   - Edit data di Google Sheets
   - Tunggu maksimal 30 detik
   - Refresh halaman atau biarkan (auto-sync akan update)
   - Verifikasi data berubah sesuai dengan Sheets

3. **Test Data Calculation:**
   - Edit Buying Price, Freight Cost, atau Other Cost di Sheets
   - Sync data
   - Verifikasi Gross Profit/MT dan Total Gross Profit dihitung ulang dengan benar

## Notes

- Sync hanya terjadi saat ada parameter `?t=...` atau `?sync` di request
- Jika sync gagal (error), data akan tetap dibaca dari cache database
- Sync tidak akan menghapus record yang baru dibuat dalam 5 menit terakhir (safety buffer)
- Semua perubahan di Sheets harus memiliki ID yang valid di kolom pertama

## Column Mapping (Google Sheets ↔ Database)

| Google Sheets Column | Database Field | Type |
|---------------------|----------------|------|
| ID | id | string (primary key) |
| PROJECT / BUYER | buyer | string |
| QUANTITY | quantity | number |
| SELLING PRICE | sellingPrice | number |
| BUYING PRICE | buyingPrice | number |
| FREIGHT COST | freightCost | number |
| OTHER COST | otherCost | number |
| GROSS PROFIT / MT | grossProfitMt | number (calculated) |
| TOTAL GROSS PROFIT | totalGrossProfit | number (calculated) |
| UPDATED AT | updatedAt | datetime |

## Related Files

- `src/lib/sheets-first-service.ts` - Service layer untuk Sheets operations
- `src/app/api/memory/pl-forecasts/route.ts` - API endpoint
- `src/app/pl-forecast/client.tsx` - Frontend UI
- `src/store/commercial-store.ts` - Zustand store untuk state management
- `sync-from-sheets.cjs` - Background sync script (independent process)
