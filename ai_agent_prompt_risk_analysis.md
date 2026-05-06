# SYSTEM INSTRUCTION: IMPLEMENT AI AGENT RISK ANALYSIS DENGAN EXTERNAL API

## <objective>
Implementasi fitur "AI Agent Risk Analysis" untuk melakukan asesmen tingkat risiko pada pengiriman (shipment). Fitur ini bertugas mengumpulkan data **berita aktual** dan **kondisi cuaca/iklim** dari berbagai sumber API pihak ketiga, mensintesis data tersebut, lalu mengirimkannya sebagai konteks kepada AI Model (Gemini/OpenAI) untuk menghasilkan skor risiko dan rekomendasi.

## <api_sources>
Sistem ini menggunakan beberapa API sebagai sumber data:

### Berita (News & Geopolitical Event)
1. **NewsAPI** (`https://newsapi.org/pricing`): Artikel berita global terkait pelabuhan, kargo, atau geopolitik.
2. **MediaStack** (`https://mediastack.com/`): Real-time news untuk memperluas jangkauan sumber regional dan internasional.

### Data Cuaca & Iklim (Weather & Climate)
3. **BMKG** (`https://data.bmkg.go.id/`): Data peringatan dini cuaca, gempa bumi, tsunami khusus untuk perairan dan wilayah Indonesia.
4. **Stormglass** (`https://stormglass.io/`): Data kelautan global (tinggi ombak, arus, cuaca laut) yang sangat krusial untuk pelayaran.
5. **OpenWeatherMap** (`https://openweathermap.org/`): Data cuaca di pelabuhan keberangkatan dan tujuan (angin, badai, visibility).
6. **WeatherAPI** (`https://www.weatherapi.com/`): Sebagai fallback/tambahan data meteorologis untuk alert cuaca kritis di rute kapal.

---

## <step_1_environment_setup>
**Target File:** `.env`

**Action:** Tambahkan key API berikut ke environment variables.
```env
# AI Provider (Gemini atau OpenAI)
AI_API_KEY=your_gemini_or_openai_key

# News APIs
NEWS_API_KEY=your_newsapi_key
MEDIASTACK_API_KEY=your_mediastack_key

# Weather & Marine APIs
STORMGLASS_API_KEY=your_stormglass_key
OPENWEATHER_API_KEY=your_openweathermap_key
WEATHER_API_KEY=your_weatherapi_key
# BMKG bersifat open data (XML/JSON), tidak wajib key namun endpoint-nya yang disesuaikan
```

---

## <step_2_api_extractors>
**Target Folder/Files:** `src/services/apiExtraction/` (BUAT FOLDER BARU)

Buat beberapa file utility untuk mengekstrak masing-masing data API dengan sistem fallback (try-catch) agar proses tidak gagal jika salah satu API timeout/limit.

### 1. `newsExtractor.ts`
Implementasikan fungsi `fetchShipmentNews(query: string)`:
- Melakukan hit ke endpoint **NewsAPI** (url: `https://newsapi.org/v2/everything?q=${query}`)
- Melakukan hit ke endpoint **MediaStack** (url: `http://api.mediastack.com/v1/news?keywords=${query}`)
- Menggabungkan top 5 berita dari kedua source tersebut.

### 2. `weatherExtractor.ts`
Implementasikan fungsi `fetchPortWeather(lat: number, lon: number)`:
- Ambil cuaca pelabuhan dari **OpenWeatherMap** atau **WeatherAPI** berdasarkan koordinat pelabuhan.
- Outputkan deskripsi cuaca, kecepatan angin (knots), dan visibilitas.

### 3. `marineExtractor.ts`
Implementasikan fungsi `fetchMarineData(lat: number, lon: number)`:
- Ambil data swell (gelombang) dan arus (current) laut menggunakan **Stormglass API**.

### 4. `bmkgExtractor.ts`
Implementasikan fungsi `fetchBMKGEarthquakeAndAlerts()`:
- Ambil data peringatan dini (XML) dari endpoint Open Data BMKG (`https://data.bmkg.go.id/DataMKG/TEWS/autogempa.xml`).
- Parsing data gempabumi terkini yang mungkin berdampak ke lajur pengiriman di Indonesia.

---

## <step_3_risk_analysis_service>
**Target File:** `src/app/api/shipments/[id]/risk-analysis/route.ts`

**Action:** Buat API route Next.js (GET/POST) yang mengorkestrasikan ekstraksi di atas menuju AI Prompt.

```typescript
// Pseudocode route.ts
import { fetchShipmentNews } from "@/services/apiExtraction/newsExtractor";
import { fetchPortWeather } from "@/services/apiExtraction/weatherExtractor";
import { fetchMarineData } from "@/services/apiExtraction/marineExtractor";
import { fetchBMKGEarthquakeAndAlerts } from "@/services/apiExtraction/bmkgExtractor";

export async function POST(req, { params }) {
  // 1. Dapatkan detail shipment dari DB (pelabuhan, produk, dsb)
  const shipment = await getShipment(params.id);
  const { loadingPort, dischargePort, product } = shipment;

  // 2. Kumpulkan Semua Data Eksternal (Parallel fetching)
  const [
    news, 
    weatherLoad, 
    weatherDischarge, 
    marineData, 
    bmkgAlerts
  ] = await Promise.all([
    fetchShipmentNews(`${loadingPort} OR ${dischargePort} maritime`),
    fetchPortWeather(shipment.loadLat, shipment.loadLon),
    fetchPortWeather(shipment.dischargeLat, shipment.dischargeLon),
    fetchMarineData(shipment.currentLat, shipment.currentLon), // if en-route
    fetchBMKGEarthquakeAndAlerts()
  ]);

  // 3. Susun PROMPT yang kaya akan Konteks API
  const prompt = `
  Anda adalah "AI Agent Risk Analyst" maritim. 
  Tugas Anda adalah menilai Risiko Pengiriman kargo: ${product} 
  Rute: ${loadingPort} -> ${dischargePort}

  DATA EKSTERNAL SAAT INI:
  - Berita Terkait (NewsAPI & MediaStack): ${JSON.stringify(news)}
  - Cuaca Area Muat (OpenWeatherMap/WeatherAPI): ${JSON.stringify(weatherLoad)}
  - Cuaca Area Bongkar (OpenWeatherMap/WeatherAPI): ${JSON.stringify(weatherDischarge)}
  - Kondisi Laut (Stormglass): ${JSON.stringify(marineData)}
  - Peringatan Dini Indonesia (BMKG): ${JSON.stringify(bmkgAlerts)}

  INSTRUKSI:
  Lakukan agregasi dari semua data di atas. Deteksi jika ada cuaca ekstrem, ombak tinggi, berita penutupan pelabuhan, atau peringatan tsunami.
  Kembalikan HANYA JSON dengan schema berikut:
  {
     "score": <number 0-100, 100=Paling Berisiko>,
     "level": "<LOW|MEDIUM|HIGH|CRITICAL>",
     "summary": "<Analisis ringkas dari berbagai sumber data ini>",
     "factors": ["Faktor yang memicu skor tinggi/rendah"],
     "recommendations": "<Tindakan yang harus diambil Admin/Operator Kapal>"
  }
  `;

  // 4. Kirim Prompt ke AI (Gemini/OpenAI)
  const aiResponse = await callAI(prompt);
  
  // 5. Update Database dan Return (Simpan Hasil ke DB)
  await updateShipmentRiskInDB(params.id, JSON.parse(aiResponse));
  
  return NextResponse.json(JSON.parse(aiResponse));
}
```

---

## <step_4_database_schema_update>
**Target File:** `prisma/schema.prisma`

**Action:** Tambahkan field ini agar aplikasi tau skor hasil generate dari analisis AI.
```prisma
model ShipmentDetail {
  // ... fields lainnya ...
  riskScore      Int?      
  riskLevel      String?   
  riskReport     String?   // JSON laporan lengkap
  lastAnalyzedAt DateTime?
}
```
Lalu migrate database: `npx prisma db push`

---

## <step_5_frontend_integration>
**Target File:** Misal di `src/app/shipment-monitor/[id]/page.tsx`

1. Buat tombol "Analyze Risk (AI)".
2. Ketika ditekan, panggil endpoint `/api/shipments/[id]/risk-analysis`.
3. Render datanya dengan warna sesuai indikasi `riskLevel` (CRITICAL = merah menyala, dll).
4. Tampilkan list "Risk Factors" yang diambil langsung dari ringkasan Cuaca & Berita yang dihasilkan AI.

