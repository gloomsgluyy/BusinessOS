const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");
const fs = require("fs");

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
let y = 0;

const colors = { primary: [15, 23, 42], accent: [59, 130, 246], muted: [100, 116, 139], bg: [248, 250, 252], white: [255,255,255], green: [22,163,74], red: [220,38,38], amber: [217,119,6] };

function checkPage(need = 20) { if (y + need > H - 20) { addFooter(); doc.addPage(); y = 20; } }
function addFooter() { doc.setFontSize(8); doc.setTextColor(...colors.muted); doc.text("Business OS (CoalTradeOS) — Handover Document — Confidential", W/2, H-10, {align:"center"}); doc.text(`Page ${doc.getNumberOfPages()}`, W-15, H-10); }

function title(text) { checkPage(30); doc.setFillColor(...colors.primary); doc.rect(0, y, W, 12, "F"); doc.setTextColor(...colors.white); doc.setFontSize(14); doc.setFont("helvetica","bold"); doc.text(text, 14, y+8); y += 18; doc.setTextColor(...colors.primary); }
function h2(text) { checkPage(15); doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...colors.accent); doc.text(text, 14, y); y += 7; doc.setTextColor(...colors.primary); }
function h3(text) { checkPage(12); doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...colors.primary); doc.text(text, 14, y); y += 6; }
function p(text, indent=14) { checkPage(8); doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(...colors.primary); const lines = doc.splitTextToSize(text, W - indent - 14); doc.text(lines, indent, y); y += lines.length * 4.5 + 2; }
function bullet(text, indent=18) { checkPage(8); doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.text("•", indent-4, y); const lines = doc.splitTextToSize(text, W - indent - 14); doc.text(lines, indent, y); y += lines.length * 4.5 + 1; }
function gap(n=4) { y += n; }
function hr() { checkPage(6); doc.setDrawColor(...colors.muted); doc.setLineWidth(0.3); doc.line(14, y, W-14, y); y += 4; }

// ===== COVER PAGE =====
doc.setFillColor(...colors.primary);
doc.rect(0, 0, W, H, "F");
doc.setTextColor(...colors.white);
doc.setFontSize(32); doc.setFont("helvetica","bold");
doc.text("HANDOVER", W/2, 80, {align:"center"});
doc.text("DOCUMENT", W/2, 95, {align:"center"});
doc.setFontSize(14); doc.setFont("helvetica","normal");
doc.text("Business OS (CoalTradeOS)", W/2, 115, {align:"center"});
doc.setDrawColor(...colors.accent); doc.setLineWidth(1);
doc.line(W/2-40, 122, W/2+40, 122);
doc.setFontSize(11);
doc.text("Internal Business Management Platform", W/2, 135, {align:"center"});
doc.text("Coal Trading Operations Suite", W/2, 143, {align:"center"});
doc.setFontSize(10); doc.setTextColor(180,190,210);
doc.text("Version 1.0.0", W/2, 165, {align:"center"});
doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"})}`, W/2, 173, {align:"center"});
doc.text("Status: Production Ready", W/2, 181, {align:"center"});
doc.setFontSize(8);
doc.text("DOKUMEN RAHASIA — HANYA UNTUK INTERNAL", W/2, H-20, {align:"center"});

// ===== PAGE 2: TABLE OF CONTENTS =====
doc.addPage(); y = 20;
title("DAFTAR ISI");
const toc = [
  ["1","Ringkasan Eksekutif"],["2","Tech Stack & Arsitektur"],["3","Struktur Project"],
  ["4","Database Schema"],["5","Fitur Terbaru & Upcoming Features"],["6","Modul & Fitur Aplikasi"],
  ["7","Sistem Autentikasi & RBAC"],["8","API Endpoints"],["9","Integrasi Eksternal"],
  ["10","Deployment & Infrastructure"],["11","Keamanan (Security Audit)"],
  ["12","Panduan Developer Baru"],["13","Known Issues & Backlog"]
];
toc.forEach(([no,t]) => { doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text(`${no}.  ${t}`, 20, y); y += 7; });

// ===== 1. EXECUTIVE SUMMARY =====
doc.addPage(); y = 20;
title("1. RINGKASAN EKSEKUTIF");
p("Business OS (CoalTradeOS) adalah platform manajemen bisnis internal berbasis web yang dibangun untuk mendukung operasional perusahaan perdagangan batu bara. Sistem ini mengintegrasikan seluruh proses bisnis mulai dari sales monitoring, shipment tracking, quality control, market price intelligence, hingga financial forecasting dalam satu dashboard terpadu.");
gap();
h2("1.1 Tujuan Sistem");
bullet("Menyediakan single source of truth untuk seluruh data operasional perusahaan");
bullet("Memantau shipment secara real-time (MV Barge & Daily Delivery)");
bullet("Tracking harga pasar komoditas batu bara (ICI 1-5, Newcastle, HBA)");
bullet("Manajemen sales pipeline, purchase requests, dan P&L forecast");
bullet("AI-powered chatbot, risk analysis, dan meeting transcription (MOM)");
bullet("Role-based access control untuk 27 posisi organisasi");
gap();
h2("1.2 Status Project");
bullet("Status: Production-ready, deployed di VPS dengan domain production");
bullet("Database: PostgreSQL (Neon) — Database-First Mode");
bullet("Users: 27 role aktif dengan RBAC terdefinisi");

// ===== 2. TECH STACK =====
doc.addPage(); y = 20;
title("2. TECH STACK & ARSITEKTUR");
h2("2.1 Frontend");
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:8},
  head:[["Teknologi","Versi","Keterangan"]],
  body:[
    ["Next.js","14.x","Framework React dengan App Router, SSR/CSR"],
    ["React","18.x","UI library utama"],
    ["TypeScript","5.x","Type-safe development"],
    ["TailwindCSS","3.x","Utility-first CSS framework"],
    ["Zustand","5.x","Lightweight state management"],
    ["Recharts","2.x","Chart & data visualization"],
    ["Lucide React","-","Icon library"],
    ["next-auth","4.x","Authentication (JWT strategy)"],
  ]
}); y = doc.lastAutoTable.finalY + 8;

h2("2.2 Backend & Database");
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:8},
  head:[["Teknologi","Versi","Keterangan"]],
  body:[
    ["Next.js API Routes","-","RESTful API endpoints"],
    ["Prisma ORM","5.22","Database ORM dengan type-safe queries"],
    ["PostgreSQL (Neon)","-","Production database (cloud-hosted)"],
    ["SQLite","-","Development database (local)"],
    ["bcryptjs","-","Password hashing"],
    ["googleapis","-","Google Sheets integration (export/backup)"],
  ]
}); y = doc.lastAutoTable.finalY + 8;

h2("2.3 AI & Integrations");
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:8},
  head:[["Service","Kegunaan"]],
  body:[
    ["Groq API","AI Chatbot & Meeting Transcription"],
    ["OpenRouter","AI Agent & Risk Analysis"],
    ["Twilio","WhatsApp notification"],
  ]
}); y = doc.lastAutoTable.finalY + 8;

// ===== 3. PROJECT STRUCTURE =====
doc.addPage(); y = 20;
title("3. STRUKTUR PROJECT");
const structure = [
  ["src/app/","Next.js App Router — halaman & API routes"],
  ["src/app/api/","Backend API endpoints (auth, chat, sheets, shipments, dll)"],
  ["src/app/page.tsx","Executive Dashboard"],
  ["src/components/","React components (layout, shared, UI, chatbot)"],
  ["src/lib/","Utility libraries (auth, rbac, prisma, scraping, sheets)"],
  ["src/store/","Zustand state stores (9 stores)"],
  ["src/types/","TypeScript type definitions"],
  ["prisma/schema.prisma","Database schema (20 models, 27 roles)"],
  ["public/","Static assets & uploaded files"],
];
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:8},
  head:[["Path","Deskripsi"]], body: structure
}); y = doc.lastAutoTable.finalY + 8;

// ===== 4. DATABASE =====
doc.addPage(); y = 20;
title("4. DATABASE SCHEMA");
p("Database menggunakan Prisma ORM dengan PostgreSQL. Schema terdefinisi di prisma/schema.prisma dengan model utama dan enum UserRole berisi 27 role.");
gap();
const models = [
  ["User","Akun pengguna dengan role, password (bcrypt), relasi ke chat & audit"],
  ["Account / Session","NextAuth adapter tables untuk OAuth & session management"],
  ["ShipmentDetail","Data shipment MV/Barge"],
  ["SourceSupplier","Database supplier/tambang batu bara dengan spec & KYC"],
  ["MarketPrice","Harga pasar harian (ICI 1-5, Newcastle, HBA, HPB)"],
  ["OutstandingPayment","Tracking pembayaran outstanding"],
  ["ProjectItem","Project management dengan approval workflow"],
  ["Partner","Database buyer & vendor/supplier"],
  ["AuditLog","Audit trail untuk semua CRUD operations"],
];
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:7.5, cellPadding:2},
  head:[["Model","Deskripsi"]], body: models
}); y = doc.lastAutoTable.finalY + 8;

// ===== 5. NEW & UPCOMING FEATURES =====
doc.addPage(); y = 20;
title("5. FITUR TERBARU & UPCOMING FEATURES");

p("Berikut adalah daftar fitur-fitur terbaru yang telah diselesaikan serta fitur-fitur yang masih dalam tahap pengembangan (upcoming).");
gap(4);

const completedFeatures = [
  ["Pemisahan Hak Akses Role", "Implementasi RBAC yang ketat dan terpisah sesuai dengan 27 role yang ada."],
  ["Alasan Pending Shipment", "Pada on-going shipment, pengguna wajib menyertakan alasan ketika status menjadi pending."],
  ["Skeleton Loader", "Diimplementasikan pada halaman Partners & Directory untuk UX yang lebih baik saat loading data."],
  ["P&L Popup Modal", "Modul Profit & Loss Forecast sekarang menggunakan UI popup modal."],
  ["Log Activity (Dashboard CEO)", "Menampilkan seluruh aktivitas user (termasuk absensi) real-time di Dashboard CEO."],
  ["Penghapusan Fitur Legacy", "Tab Daily Delivery dan Route Optimizer telah dihapus dari sistem."],
];

autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.green}, styles:{fontSize:8},
  head:[["Fitur (Selesai)", "Deskripsi / Catatan"]], body: completedFeatures
}); y = doc.lastAutoTable.finalY + 8;

const upcomingFeatures = [
  ["Template Project", "Modul Project nantinya akan dilengkapi dengan template standar pembuatan project."],
  ["AI Mitigation Recommendation", "Pada Detail Shipment > Risk Analysis, AI akan memberikan rekomendasi mitigasi aktif."],
  ["Weather API Integration", "Detail cuaca pada Risk Analysis akan diotomatisasi melalui integrasi API Cuaca eksternal."],
  ["Demurrage Source Update", "Data demurrage ditarik otomatis dari Operational Info (yang nantinya dapat diedit user)."],
  ["AI Urgent Project Analysis", "AI menganalisis urgensi tiap project vs News API. Notif khusus Dashboard CEO/Dirut."],
  ["Market Price Comparison", "Trader dapat membandingkan harga per market dengan data riwayat penjualan & pembelian."],
  ["Legalitas Tenggat Waktu", "Peringatan otomatis (deadline alert) sesuai dokumen legalitas di Partners & Directory."],
  ["AI Agent (Excel Context)", "AI Agent interaktif yang memiliki pemahaman penuh terhadap seluruh dokumen Excel."],
];

autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.amber}, styles:{fontSize:8},
  head:[["Fitur (On-Going / Upcoming)", "Deskripsi / Target"]], body: upcomingFeatures
}); y = doc.lastAutoTable.finalY + 8;

// ===== 6. MODULES =====
doc.addPage(); y = 20;
title("6. MODUL & FITUR APLIKASI");
const modules = [
  ["/ (Dashboard)","Executive dashboard & Activity Log","CEO, DIRUT, COO, Ass.DIRUT"],
  ["/sales-monitor","Sales pipeline & deal management","CMO, Traders, Admin Marketing"],
  ["/sales-orders","Sales order CRUD dengan approval","Traders, Admin Marketing"],
  ["/shipment-monitor","Shipment tracking, risk analysis","Traffic Team, Admin Operation"],
  ["/market-price","Harga pasar batu bara (ICI, HBA)","All commercial roles"],
  ["/outstanding-payment","Tracking pembayaran outstanding","Admin Operation, Traffic Head"],
  ["/projects","Project management (soon w/ Template)","CPPO, Traders"],
  ["/directory","Database partner (buyer/vendor)","Admin, Sourcing"],
  ["/audit-logs","Audit trail viewer","CEO, DIRUT"],
];
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:7, cellPadding:2},
  head:[["Route","Deskripsi","Akses Utama"]], body: modules
}); y = doc.lastAutoTable.finalY + 8;

// ===== 7. AUTH & RBAC =====
doc.addPage(); y = 20;
title("7. SISTEM AUTENTIKASI & RBAC");
h2("7.1 Authentication");
bullet("Provider: NextAuth.js v4 dengan Credentials Provider");
bullet("Strategy: JWT (stateless session)");
bullet("Password: bcryptjs hashing");
gap();
h2("7.2 Role-Based Access Control");
p("Sistem mendefinisikan 27 role dalam enum UserRole. Fitur terbaru telah memastikan isolasi dan pemisahan hak akses (RBAC) di tingkat UI dan API sesuai dengan job desc masing-masing role.");

// ===== 8. API =====
doc.addPage(); y = 20;
title("8. API ENDPOINTS");
const apis = [
  ["/api/auth/[...nextauth]","NextAuth handler (login/logout)"],
  ["/api/chat","AI chatbot endpoint"],
  ["/api/memory/*","CRUD untuk semua entitas bisnis"],
  ["/api/shipments/[id]/risk-analysis","AI risk analysis per shipment (Mitigation coming)"],
  ["/api/users","User management & Activity Log"],
];
autoTable(doc, { startY: y, margin:{left:14,right:14}, headStyles:{fillColor:colors.accent}, styles:{fontSize:8},
  head:[["Endpoint","Deskripsi"]], body: apis
}); y = doc.lastAutoTable.finalY + 8;

// ===== 9. INTEGRATIONS =====
doc.addPage(); y = 20;
title("9. INTEGRASI EKSTERNAL");
bullet("Groq API: Chatbot conversation & audio transcription");
bullet("OpenRouter: AI agent untuk risk analysis & market intelligence");
bullet("Weather API (Upcoming): Integrasi data cuaca otomatis");
bullet("News API (Upcoming): Analisis project urgency oleh AI");

// ===== 10. DEPLOYMENT =====
doc.addPage(); y = 20;
title("10. DEPLOYMENT & INFRASTRUCTURE");
bullet("Platform: Node.js (Next.js Standalone)");
bullet("Database: PostgreSQL (Neon Cloud)");
bullet("Start Command: pm2 start npm --name business-os -- start");

// ===== 11. SECURITY =====
doc.addPage(); y = 20;
title("11. KEAMANAN (SECURITY AUDIT)");
bullet("Audit logging konsisten di semua CRUD route");
bullet("Soft delete diimplementasikan dengan baik (field isDeleted)");
bullet("Pemisahan akses role di backend telah divalidasi dengan tuntas");

// ===== 12. DEVELOPER GUIDE =====
doc.addPage(); y = 20;
title("12. PANDUAN DEVELOPER BARU");
bullet("Gunakan 'npx prisma generate' dan 'npx prisma db push' untuk sync database.");
bullet("Implementasikan fitur upcoming sesuai urutan prioritas di bagian 5.2.");
bullet("Selalu gunakan Zustand store untuk state management yang bersifat global.");
bullet("Setiap route API yang memanipulasi data wajib menyertakan verifikasi session role.");

// Add footers to all pages
const totalPages = doc.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  addFooter();
}

// Save
const outputPath = "Handover_Document.pdf";
const buffer = doc.output("arraybuffer");
fs.writeFileSync(outputPath, Buffer.from(buffer));
console.log(`\n✅ Handover document generated: ${outputPath}`);
console.log(`   Pages: ${totalPages}`);
