# Instruksi Implementasi: AI Operational Risk Analysis untuk Shipment

Dokumen ini berisi panduan teknis langkah demi langkah untuk membangun fitur **AI Operational Risk Analysis** pada halaman detail shipment, serta integrasi sistem peringatan risiko ke halaman Admin.

---

## 1. Arsitektur Flow Data

1. **Triggering**: Analisis bisa dipicu secara manual via tombol "Analyze Risk" di halaman detail shipment, atau berjalan otomatis via Cron Job setiap beberapa jam untuk seluruh shipment aktif.
2. **Data Gathering**: Sistem (Backend) menarik data shipment (lokasi asal, tujuan, jenis barang, estimasi waktu).
3. **External API Calls**: Sistem memanggil API eksternal (Cuaca untuk lokasi asal/tujuan/rute, Berita terkait pelabuhan/rute, dll).
4. **AI Processing**: Semua konteks (data shipment + berita + cuaca) dikirim ke LLM (OpenAI/Gemini/Claude) dengan instruksi sistem untuk menganalisis risiko.
5. **Output Parsing**: AI mengembalikan data terstruktur (JSON) berisi: `riskLevel`, `riskScore`, `summary`, dan `recommendations`.
6. **Data Persistence**: Hasil analisis disimpan ke database (tabel `Shipment`).
7. **Notification**: Jika `riskLevel` adalah `HIGH` atau `CRITICAL`, sistem men-trigger _Notification_ ke role Admin.
8. **UI Rendering**: Halaman Shipment Detail menampilkan laporan analisis AI, dan halaman Dashboard Admin menampilkan notifikasi & daftar urutan shipment paling berisiko.

---

## 2. Modifikasi Schema Database (Prisma)

Update file `prisma/schema.prisma` untuk menyimpan hasil analisis dan notifikasi.

```prisma
// Tambahkan field di model Shipment yang sudah ada
model Shipment {
  // ... existing fields (id, origin, destination, dll)

  // -- Risk Analysis Fields --
  riskLevel     RiskLevel?
  riskScore     Int?       // Skor 1 - 100
  riskSummary   String?    @db.Text
  riskDetails   Json?      // Menyimpan data lengkap rekomendasi & breakdown AI
  lastRiskCheck DateTime?

  // Relasi
  notifications Notification[]
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// Tambahkan model Notification jika belum ada
model Notification {
  id          String   @id @default(cuid())
  shipmentId  String?
  shipment    Shipment? @relation(fields: [shipmentId], references: [id])
  title       String
  message     String   @db.Text
  isRead      Boolean  @default(false)
  roles       String[] // Menyimpan role yang berhak membaca, misal: ["ADMIN", "MANAGER"]
  createdAt   DateTime @default(now())
}
```

_Jalankan command: `npx prisma migrate dev --name add_risk_analysis`_

---

## 3. Persiapan API Keys Eksternal

Tambahkan API keys berikut ke dalam file `.env`:

```env
# AI Provider (Pilih salah satu)
OPENAI_API_KEY=your_openai_api_key_here
# GEMINI_API_KEY=your_gemini_api_key_here

# Weather API (Contoh: OpenWeatherMap / WeatherAPI)
WEATHER_API_KEY=your_weather_api_key_here

# News API (Contoh: NewsAPI.org / GNews.io)
NEWS_API_KEY=your_news_api_key_here
```

---

## 4. Pembuatan Backend Services

Buat folder/file service di `src/services/` (atau direktori utilitas server-side yang ada).

### A. Data Gatherers (`src/services/externalApi.ts`)

Buat fungsi untuk mengambil data terkait lokasi pengiriman:

- `getWeatherForecast(location: string, date: Date)`
- `getNewsAlerts(keywords: string)` (keyword: nama pelabuhan, rute, situasi maritim/lalulintas).

### B. AI Engine (`src/services/aiRisk.ts`)

Buat service untuk mengatur _prompting_ ke AI. Rekomendasi Format Prompt:

> "Kamu adalah Cargo Risk Analyst. Berikut adalah data shipment tujuan [Tujuan], berisi barang [Barang].
> Kondisi cuaca: [Data Cuaca].
> Berita terkini di rute tersebut: [Data Berita].
> Analisis risikonya dan kembalikan HANYA dalam format JSON dengan skema:
> { "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL", "riskScore": "0-100", "summary": "deskripsi", "recommendations": ["saran 1", ...] }"

### C. Analisis API Endpoint (`src/app/api/shipments/[id]/risk-analysis/route.ts`)

Endpoint ini akan:

1. Memanggil Data Gatherers
2. Mengirim data ke AI Engine
3. Memperbarui tabel `Shipment`
4. Cek: `if (aiResult.riskLevel === 'HIGH' || aiResult.riskLevel === 'CRITICAL')` -> Buat record baru di tabel `Notification`.

---

## 5. Implementasi Frontend (UI)

### A. Halaman Shipment Detail (`/shipment-monitor/[id]`)

Kembangkan komponen tab **Risk Analysis**:

- **Status Box**: Menampilkan `riskLevel` dengan warna sesuai (Merah untuk CRITICAL, Kuning untuk MEDIUM, Hijau untuk LOW).
- **Skor**: Progress bar untuk `riskScore`.
- **Ringkasan Analisis ai**: Teks summary dari AI.
- **Tombol "Refresh Analysis"**: Memanggil Endpoint API (Langkah 4C) untuk memperbarui data berdasarkan API waktu nyata (cuaca/berita terbaru).

### B. Halaman Admin Dashboard (`/admin/dashboard` atau `/shipment-monitor`)

- **Top Risk Table**:
  Fetch shipments dengan query order by:
  `prisma.shipment.findMany({ orderBy: { riskScore: 'desc' }, take: 5 })`
  Tampilkan daftar shipment berurut dari yang paling berisiko ke yang paling rendah.
- **Notification Bell**:
  Fetch dari model `Notification` di mana `isRead === false`.
  Munculkan alert/toast/dropdown merah jika ada shipment baru yang berstatus HIGH/CRITICAL.

---

## 6. Otomatisasi (Cron Job / Background Task)

Agar list dan notifikasi di admin selalu _up-to-date_ tanpa pemicu manual:

- Gunakan library seperti `node-cron` di entrypoint server atau GitHub Actions/Cron Service.
- Set cron untuk berjalan misal setiap 8 jam: Akan melooping semua shipment berstatus **IN_TRANSIT** -> Jalankan AI risk analysis secara otomatis -> Simpan skor/level -> Trigger Notifikasi jika ada peningkatan risiko.

## Checklist Task Execution

- [ ] Setup Schema DB & Migrate.
- [ ] Register API Keys (OpenAI, WeatherAPI, NewsAPI) dan pasang di `.env`.
- [ ] Buat integrasi Weather & News.
- [ ] Buat integrasi AI prompt formatter dan parser JSON.
- [ ] Buat POST endpoint untuk trigger kalkulasi risiko per shipment.
- [ ] Buat logic pembuatan Notifikasi Admin saat skor di atas ambang batas.
- [ ] Bikin UI Tab "Risk Analysis" di halaman detail shipment.
- [ ] Bikin UI Tabel "Shipments At Risk" di admin dashboard.
- [ ] Bikin sistem Cron untuk auto-update skor (Opsional).
