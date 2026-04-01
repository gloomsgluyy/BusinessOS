# Prompt: Implementasi Automated Scraping Global untuk Data Market Price

**Konteks:**
Saat ini, sistem *automated scraping* berbasis AI untuk mengambil harga komoditas (ICI, Newcastle, HBA) hanya berjalan ketika pengguna membuka halaman `/market-price`. Logika *polling* (menggunakan `useEffect` dan `setInterval`) terikat pada siklus hidup (lifecycle) komponen halaman tersebut.

**Tujuan:**
Mengubah mekanisme *automated scraping* sehingga berjalan di latar belakang (background) secara global sejak pengguna pertama kali membuka website (aplikasi), tidak peduli halaman manapun yang sedang mereka akses.

**Instruksi Teknis yang Harus Dilakukan:**

1. **Ekstraksi Logika Scraping:**
   - Pisahkan logika `fetchMarketPrices` beserta manajemen interval (seperti `autoScrape` dan `scrapeInterval` yang defaultnya 6 jam) dari `src/app/market-price/page.tsx`.
   - Buat sebuah custom hook (misal: `useGlobalMarketScraper`) atau komponen *provider* kosong (misal: `GlobalMarketScraper.tsx` di folder `src/components/`).

2. **Manajemen State Global & Persistensi Interval:**
   - Karena pengguna bisa berpindah-pindah halaman atau melakukan *refresh*, gunakan `localStorage` atau *persisted state* (Zustand) untuk menyimpan *timestamp* (waktu) terakhir kali *scraping* sukses dilakukan.
   - Saat komponen global di-*mount*, cek apakah waktu sekarang dikurangi waktu `lastScrapeTime` sudah melebihi interval (misalnya 6 jam). Jika ya, jalankan *scraping*. Jika tidak, atur *timeout/interval* untuk sisa waktunya.

3. **Integrasi dengan Backend & Store:**
   - Saat waktunya tiba, panggil API `/api/market-scrape`.
   - Pastikan hasil dari API tetap dimasukkan ke dalam *state management* global, yaitu dengan memanggil fungsi `addMarketPrice` dari `useCommercialStore` (`src/store/commercial-store.ts`) agar data harga di seluruh aplikasi diperbarui.

4. **Pemasangan di Root Layout:**
   - Pasang (import) komponen atau hook `GlobalMarketScraper` tersebut di `src/app/layout.tsx` (atau di dalam komponen Client Provider yang membungkus seluruh aplikasi, seperti bersamaan dengan `auth-provider` atau `session-sync`).
   - Pastikan tidak ada *memory leak*; bersihkan interval (`clearInterval`) pada saat *unmount* (meskipun pada root layout hal ini jarang terjadi).

**Hasil Akhir yang Diharapkan:**
Website akan otomatis mengambil pembaruan harga pasar secara diam-diam di *background* setiap interval waktu yang ditentukan (misalnya 6 jam), selama aplikasi terbuka di *browser*, terlepas dari halaman apa pun yang sedang dilihat oleh pengguna.
