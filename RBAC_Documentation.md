# Dokumentasi Role-Based Access Control (RBAC) - 11gawe

Dokumen ini mendefinisikan Hak Akses (Role-Based Access Control) untuk setiap role dalam sistem **11gawe**. Pembagian hak akses didasarkan pada logika operasional perusahaan, pemisahan tugas (segregation of duties), dan modul-modul sistem yang tersedia (seperti Shipment, Sales Orders, Outstanding Payments, Quality, dll).

## 📌 Ringkasan Prinsip Akses
1. **Pemisahan Tanggung Jawab:** Setiap role hanya diberikan hak akses Create/Edit/Delete pada modul yang menjadi tanggung jawabnya.
2. **Visibilitas Eksekutif:** Posisi C-Level dan Eksekutif (CEO, DIRUT, dll) mendapatkan akses **Read-Only (Viewer)** yang komprehensif di seluruh dasbor, dengan hak **Approval (Approve/Reject)** pada alur kerja eskalasi.
3. **Prinsip Least Privilege:** Staf administratif hanya diberikan akses operasional pada modulnya masing-masing.

---

## 1. Jajaran Eksekutif (Executive Level)
**Role:** `CEO`, `DIRUT`, `Ass. DIRUT`
**Tanggung Jawab:** Pengawasan operasional, pemasaran, keuangan, dan seluruh proses bisnis dari level tertinggi.

| Modul / Fitur | Hak Akses | Keterangan |
| --- | --- | --- |
| **All Dashboards (Profit & Loss, Sales, Shipment)** | Read | Visibilitas penuh ke seluruh laporan dan dasbor performa. |
| **Persetujuan (Approval Inbox)** | Approve | Menyetujui pengajuan khusus, seperti transaksi nilai tinggi atau _purchase requests_. |
| **Audit Logs & Compliance** | Read | Melihat riwayat aktivitas sistem untuk pengawasan internal. |
| **Users / Hak Akses** | Read (View) | Hanya melihat daftar pengguna, pembuatan dilakukan oleh IT/Admin. |
| **Meetings (MoM)** | Read / Write | Dapat melihat dan membuat catatan <i>Minutes of Meeting</i> penting. |
| **Modul Operasional (Sales, Sourcing, Traffic)** | Read | Read-Only untuk seluruh riwayat pesanan penjualan, operasional logistik, sirkulasi uang, dll. |

---

## 2. Jajaran Direksi C-Level & Head (Management)
**Role:** `Chief Operation Officer` (COO / Traders 3), `Chief Marketing Officer` (CMO / Traders 4), `Chief Product & Project Officer` (CPPO / Traders 2)
**Tanggung Jawab:** Pimpinan tiap-tiap divisi yang bertanggung jawab atas target divisi.

#### 🔸 Chief Operation Officer (COO)
| Modul / Fitur | Hak Akses | Keterangan |
| --- | --- | --- |
| **Dashboard Operasional & Shipment** | Read | Pemantauan total operasional perusahaan. |
| **Quality & Blending, Transshipment** | Read / Approve | Persetujuan operasional tingkat akhir. |
| **Approval Inbox** | Read / Approve / Reject | Meninjau izin biaya operasional atau pembatalan shipment. |

#### 🔸 Chief Marketing Officer (CMO)
| Modul / Fitur | Hak Akses | Keterangan |
| --- | --- | --- |
| **Sales Monitor & Market Price** | Read | Memantau seluruh harga pasar dan proyeksi KPI penjualan. |
| **Sales Orders & PL Forecast** | Read / Approve | Memberikan _approval_ pada Sales Order dan meninjau P&L proyeksi penjualan. |
| **Outstanding Payment** | Read | Pemantauan klien yang memiliki tagihan belum lunas. |

#### 🔸 Chief Product & Project Officer (CPPO)
| Modul / Fitur | Hak Akses | Keterangan |
| --- | --- | --- |
| **Projects, Quality & Blending** | Read / Approve | Memegang kendali pada strategi _blending_ produksi dan proyek. |
| **Purchase Requests** | Read / Approve | _Approval_ akhir untuk perizinan proyek/produk bahan baku. |

---

## 3. Divisi Trading & Marketing
**Role:** `Traders 1`, `Traders 2/CPPO`, `Traders 3/COO`, `Traders 4/CMO`, `Junior Trader`, `Admin Marketing`
**Tanggung Jawab:** Menyusun strategi jual-beli, mencari _supplier_ batu bara/komoditas, melihat tren harga pasar, dan mencatat transaksi penjualan.

| Modul / Fitur | Traders (1,2,3,4, Junior) | Admin Marketing | Keterangan |
| --- | --- | --- | --- |
| **Market Price** | Read | Read / Write | Admin rutin memperbarui harga pasar harian. |
| **Sales Orders** | Read / Write / Update | Read / Write / Update | Traders menyusun kontrak _deals_, Admin meng-input data ke sistem. |
| **PL Forecast** | Read / Write / Update | Read | Traders menyusun hitungan (Profit Loss Forecast) per transaksi. |
| **Purchase Requests** | Read / Write | No Access | Pengajuan pencairan pembelian barang/jasa untuk _trade_. |
| **Sources (Sourcing)** | Read | Read | Membaca basis data ketersediaan sumber komoditas. |
| **Directory** | Read | Read / Write | Admin mengelola data klien dan supplier. |

---

## 4. Divisi Traffic & Logistik
**Role:** `Traffic Head`, `Traffic Team 1, 2, 3, 4`
**Tanggung Jawab:** Memastikan kelancaran pengiriman, pencarteran kapal/tongkang, _transshipment_, dan penyelesaian masalah logistik dari pelabuhan sampai ke _buyer_.

| Modul / Fitur | Traffic Head | Traffic Team (1/2/3/4) | Keterangan |
| --- | --- | --- | --- |
| **Shipment Monitor** | Read / Write / Approve | Read / Write / Update | Head dapat _Approve/Delete_. Team mencatat/update status tracking. |
| **Transshipment** | Read / Write / Approve | Read / Write / Update | Pemantauan perpindahan barang dari tongkang ke _Mother Vessel_. |
| **Outstanding Payment** | Read | Read | Mengecek apakah demurrage/tagihan kargo dapat dilanjutkan atau ditahan. |
| **Sales Orders** | Read | Read | Meninjau spesifikasi _delivery_ pada kontrak penjualan. |

---

## 5. Divisi Operasional (Umum & Administrasi)
**Role:** `Admin Operation`
**Tanggung Jawab:** Mengisi dokumentasi operasional harian perusahaan, mencatat surat jalan, dan koordinasi dokumen antar departemen.

| Modul / Fitur | Hak Akses | Keterangan |
| --- | --- | --- |
| **Operations** | Read / Write / Update | Input data reguler dari pelabuhan / tambang. |
| **Shipment Monitor** | Read / Write / Update | Bantuan pencatatan (clerical) untuk Traffic Team jika dibutuhkan. |
| **Directory** | Read / Write | Pencatatan detail vendor, surveyor, dan agensi. |
| **Semua Dasbor C-Level** | No Access | Tidak memiliki akses pada laporan Profit/Loss, PL Forecast, dsb. |

---

## 6. Divisi Sourcing (Pembelian & Suplai)
**Role:** `Spv. Sourcing`, `Sourcing Officer 1, 2, 3, 4`
**Tanggung Jawab:** Mencari sumber barang tambang/komoditas, negosiasi dengan tambang, mengatur spesifikasi.

| Modul / Fitur | Spv. Sourcing | Sourcing Officer (1/2/3/4) | Keterangan |
| --- | --- | --- | --- |
| **Sources** | Read / Write / Approve | Read / Write / Update | Spv mem-validasi _supplier_ tambang. Officer melakukan input data sumber barang. |
| **Purchase Requests** | Read / Write / Approve | Read / Write | Officer membuat pengajuan; Spv menyetujui pengajuan _Purchase Request_. |
| **Quality & Blending** | Read | Read | Meninjau riwayat kualitas produk dari spesifikasi tambang. |
| **Market Price** | Read | Read | Acuan dalam melakukan penawaran harga beli ke tambang. |

---

## 7. Divisi Quality Control (QC & QA)
**Role:** `Quality & Quantity Manager`, `QC Manager`, `QC Admin 1`, `QC Admin 2`
**Tanggung Jawab:** Mengecek parameter kualitas produk (Kalori, Moisture, Ash, Sulfur, dll) baik di _stockpile_ maupun di kapal, dan simulasi persentase _blending_.

| Modul / Fitur | Q&Q / QC Manager | QC Admin (1/2) | Keterangan |
| --- | --- | --- | --- |
| **Quality** | Read / Write / Approve | Read / Write / Update | Pencatatan hasil sertifikat analisis (COA) dari surveyor. Manager mem-validasi _final report_. |
| **Blending** | Read / Write / Approve | Read / Write / Update | Manajemen komposisi pencampuran (_blending_) batu bara. |
| **Operations** | Read | Read | Mengawasi kelancaran operasional lapangan secara dokumentatif. |
| **Shipment Monitor** | Read | Read | Meninjau tongkang mana yang sedang ditangani proses _sampling_-nya. |

---

## 🔒 Aturan Tambahan Keamanan
1. **Hak "Delete" (Hapus Permanen)** sangat dibatasi, umumnya hanya diberikan kepada akun Super Admin (IT) atau level Head/Manager melalui _reason input_ atau validasi khusus (Soft Delete dianjurkan).
2. **Role Ganda:** Jika seseorang memiliki dua posisi (misal: "Traders 2/CPPO"), sistem secara logik menggabungkan profil akses hak Traders dan hak CPPO (dengan prioritas _tier_ tertinggi).
3. **Data Visibilty Restriction:** *Traffic Team 1* hingga *Team 4* maupun *Sourcing Officer 1* hingga *4* dapat diatur lebih ketat untuk hanya bisa melihat dan mengelola projek/berkas yang _di-assign_ (ditugaskan) kepadanya spesifik, meskipun memiliki _Role Map_ yang sama (Row-Level Security).
