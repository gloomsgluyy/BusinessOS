const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");
const fs = require("fs");

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const W = doc.internal.pageSize.getWidth();
const H = doc.internal.pageSize.getHeight();
let y = 0;

const C = { primary: [15,23,42], accent: [59,130,246], muted: [100,116,139], white: [255,255,255] };

function checkPage(n=20){if(y+n>H-20){doc.addPage();y=20;}}
function addFooter(){doc.setFontSize(8);doc.setTextColor(...C.muted);doc.text("Business OS — Handover Document — Confidential",W/2,H-10,{align:"center"});doc.text(`Page ${doc.getNumberOfPages()}`,W-15,H-10);}
function title(t){checkPage(25);doc.setFillColor(...C.primary);doc.rect(0,y,W,12,"F");doc.setTextColor(...C.white);doc.setFontSize(14);doc.setFont("helvetica","bold");doc.text(t,14,y+8);y+=18;doc.setTextColor(...C.primary);}
function h2(t){checkPage(12);doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(...C.accent);doc.text(t,14,y);y+=7;doc.setTextColor(...C.primary);}
function p(t,i=14){checkPage(8);doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(...C.primary);const l=doc.splitTextToSize(t,W-i-14);doc.text(l,i,y);y+=l.length*4.5+2;}
function bullet(t,i=18){checkPage(8);doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text("•",i-4,y);const l=doc.splitTextToSize(t,W-i-14);doc.text(l,i,y);y+=l.length*4.5+1;}
function gap(n=4){y+=n;}

function table(headers, rows, opts={}){
  checkPage(30);
  autoTable(doc, {
    startY: y, margin:{left:14,right:14},
    headStyles:{fillColor: opts.headColor || C.accent, fontSize:8, fontStyle:"bold"},
    styles:{fontSize: opts.fontSize || 8, cellPadding:2, textColor:C.primary},
    head:[headers], body:rows,
    didDrawPage: () => {}
  });
  y = doc.lastAutoTable.finalY + 8;
}

// ===== COVER =====
doc.setFillColor(...C.primary);doc.rect(0,0,W,H,"F");
doc.setTextColor(...C.white);
doc.setFontSize(32);doc.setFont("helvetica","bold");
doc.text("HANDOVER",W/2,80,{align:"center"});
doc.text("DOCUMENT",W/2,95,{align:"center"});
doc.setFontSize(14);doc.setFont("helvetica","normal");
doc.text("Business OS (CoalTradeOS)",W/2,115,{align:"center"});
doc.setDrawColor(...C.accent);doc.setLineWidth(1);doc.line(W/2-40,122,W/2+40,122);
doc.setFontSize(11);
doc.text("Internal Business Management Platform",W/2,135,{align:"center"});
doc.text("Coal Trading Operations Suite",W/2,143,{align:"center"});
doc.setFontSize(10);doc.setTextColor(180,190,210);
doc.text("Version 1.0.0",W/2,165,{align:"center"});
doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"})}`,W/2,173,{align:"center"});
doc.text("Status: Production Ready",W/2,181,{align:"center"});
doc.setFontSize(8);doc.text("DOKUMEN RAHASIA — HANYA UNTUK INTERNAL",W/2,H-20,{align:"center"});

// ===== TOC =====
doc.addPage();y=20;
title("DAFTAR ISI");
["1. Ringkasan Eksekutif","2. Tech Stack & Arsitektur","3. Struktur Project","4. Database Schema","5. Modul & Fitur Aplikasi","6. Autentikasi & RBAC","7. API Endpoints","8. Integrasi Eksternal","9. Deployment & Infrastructure","10. Keamanan","11. Panduan Developer Baru","12. Known Issues & Backlog"].forEach(t=>{doc.setFontSize(10);doc.setFont("helvetica","normal");doc.setTextColor(...C.primary);doc.text(t,20,y);y+=7;});

// ===== 1 =====
doc.addPage();y=20;
title("1. RINGKASAN EKSEKUTIF");
p("Business OS (CoalTradeOS) adalah platform manajemen bisnis internal berbasis web untuk operasional perusahaan perdagangan batu bara. Mengintegrasikan sales monitoring, shipment tracking, quality control, market price intelligence, dan financial forecasting dalam satu dashboard.");
gap();
h2("1.1 Tujuan Sistem");
bullet("Single source of truth untuk seluruh data operasional");
bullet("Real-time shipment monitoring (MV Barge & Daily Delivery)");
bullet("Market price tracking (ICI 1-5, Newcastle, HBA)");
bullet("Sales pipeline, purchase requests, P&L forecast");
bullet("AI chatbot, risk analysis, meeting transcription");
bullet("RBAC untuk 27 posisi organisasi");
gap();
h2("1.2 Status");
bullet("Production-ready, deployed via VPS + Neon PostgreSQL");
bullet("Database-First Mode (Google Sheets optional)");
bullet("2,000+ records historis dimigrasikan dari Excel");

// ===== 2 =====
doc.addPage();y=20;
title("2. TECH STACK & ARSITEKTUR");
h2("2.1 Frontend");
table(["Teknologi","Versi","Keterangan"],[
  ["Next.js","14.x","App Router, SSR/CSR"],["React","18.x","UI library"],
  ["TypeScript","5.x","Type-safe"],["TailwindCSS","3.x","Utility CSS"],
  ["Zustand","5.x","State management"],["Recharts","2.x","Charts"],
  ["next-auth","4.x","Auth (JWT)"],["Lucide React","-","Icons"]
]);
h2("2.2 Backend & Database");
table(["Teknologi","Versi","Keterangan"],[
  ["Next.js API Routes","-","REST API"],["Prisma ORM","5.22","Type-safe ORM"],
  ["PostgreSQL (Neon)","-","Production DB"],["SQLite","-","Dev DB"],
  ["bcryptjs","-","Password hashing"],["googleapis","-","Sheets integration"]
]);
h2("2.3 AI & Integrations");
table(["Service","Kegunaan"],[
  ["Groq API","Chatbot & Transcription"],["OpenRouter","AI Agent & Risk Analysis"],
  ["Twilio","WhatsApp notification"],["Google Sheets API","Export/backup"],["jsPDF","PDF generation"]
]);

// ===== 3 =====
doc.addPage();y=20;
title("3. STRUKTUR PROJECT");
table(["Path","Deskripsi"],[
  ["src/app/","Next.js App Router pages & API"],["src/app/api/","Backend API endpoints"],
  ["src/app/page.tsx","Executive Dashboard (98KB)"],["src/components/","React components"],
  ["src/lib/","Utilities (auth, rbac, prisma, scraping)"],["src/store/","Zustand stores (9 files)"],
  ["src/types/","TypeScript definitions"],["src/hooks/","Custom hooks"],
  ["src/middleware.ts","Route protection"],["prisma/schema.prisma","DB schema (20 models, 27 roles)"],
  ["scripts/","Migration & utility scripts"],["public/","Static assets"]
]);
h2("3.1 Zustand Stores");
table(["File","Fungsi"],[
  ["commercial-store.ts","Master store (73KB) — shipments, deals, prices, meetings"],
  ["auth-store.ts","Session & user state"],["task-store.ts","Task/kanban management"],
  ["sales-store.ts","Sales orders"],["purchase-store.ts","Purchase requests"],
  ["daily-delivery-store.ts","Daily delivery CRUD"],["directory-store.ts","Partner directory"],
  ["outstanding-payment-store.ts","Payment tracking"],["ui-store.ts","UI state"]
]);

// ===== 4 =====
doc.addPage();y=20;
title("4. DATABASE SCHEMA");
p("Prisma ORM + PostgreSQL. 20 models, enum UserRole (27 roles). File: prisma/schema.prisma");
gap();
table(["Model","Deskripsi"],[
  ["User","Akun + role + relasi chat/audit"],["ChatHistory","Chat AI per user (isolated)"],
  ["TaskItem","Kanban tasks"],["SalesOrder","Sales orders + approval"],
  ["PurchaseRequest","Purchase + OCR + anomaly"],["ShipmentDetail","Shipment MV/Barge (40+ kolom, risk fields)"],
  ["DailyDelivery","Laporan harian (40+ kolom)"],["SourceSupplier","Supplier/tambang + spec"],
  ["QualityResult","Sampling kualitas (GAR, TS, Ash, TM)"],["MarketPrice","Harga pasar (ICI, HBA, HPB)"],
  ["OutstandingPayment","Payment tracking"],["MeetingItem","Meeting + AI MOM"],
  ["MeetingMedia","Media files + transcription"],["PLForecast","P&L forecast per deal"],
  ["SalesDeal","Sales pipeline"],["ProjectItem","Project + approval"],
  ["Partner","Buyer & vendor"],["BlendingSimulation","Blending simulator"],
  ["AuditLog","Audit trail"],["SyncState","Sync state tracking"]
],{fontSize:7.5});

// ===== 5 =====
doc.addPage();y=20;
title("5. MODUL & FITUR APLIKASI");
table(["Route","Deskripsi","Akses"],[
  ["/","Executive Dashboard","CEO, DIRUT, COO"],
  ["/sales-monitor","Sales pipeline","CMO, Traders"],
  ["/sales-orders","Sales order CRUD","Traders, Admin Marketing"],
  ["/shipment-monitor","Shipment tracking + risk analysis","Traffic, Admin Op"],
  ["/market-price","Harga pasar + HPB calculator","All commercial"],
  ["/pl-forecast","P&L forecast","Traders, CMO"],
  ["/outstanding-payment","Payment tracking","Admin Op, Traffic Head"],
  ["/sources","Supplier database","Sourcing Team"],
  ["/quality","Quality results (COA)","QC Team"],
  ["/blending","Blending simulation","QC, Sourcing"],
  ["/purchase-requests","Purchase + anomaly","All (role-based)"],
  ["/projects","Project management","CPPO, Traders"],
  ["/meetings","Meeting + AI MOM","All roles"],
  ["/directory","Partner database","Admin, Sourcing"],
  ["/my-tasks","Personal tasks","All roles"],
  ["/all-tasks","Global kanban","Manager+"],
  ["/audit-logs","Audit trail","CEO, DIRUT"],
  ["/users","User management","Admin"],
],{fontSize:7});

// ===== 6 =====
doc.addPage();y=20;
title("6. AUTENTIKASI & RBAC");
h2("6.1 Authentication");
bullet("NextAuth.js v4, Credentials Provider, JWT strategy");
bullet("Password hashing: bcryptjs");
bullet("Middleware: route protection + role-based redirect");
bullet("Dashboard (/) restricted to CEO, DIRUT, ASS_DIRUT, COO");
gap();
h2("6.2 RBAC Modules (src/lib/rbac.ts)");
table(["Module","Cakupan","Roles"],[
  ["PL_SALES","P&L + Sales Monitor","Traders, CMO, Admin Marketing"],
  ["OPERATIONS_TRAFFIC","Shipment + Transshipment","Traffic, Admin Op, QC"],
  ["QUALITY_BLENDING","Quality + Blending","QC Team, Sourcing"],
  ["SOURCING","Sourcing + Purchase","Sourcing Team, Traders"],
  ["MARKET_PRICE","Market Price","Traders, Admin, Sourcing"],
  ["DIRECTORY","Vendors/Clients","Admin, Sourcing, Traders"],
  ["OUTSTANDING_PAYMENT","Payments","Admin Op, Traffic Head"]
]);
p("Permission levels: read, write, approve. Functions: canReadModule(), canWriteModule(), canApproveModule().");
p("27 roles didefinisikan dalam enum UserRole: CEO, DIRUT, ASS_DIRUT, COO, CMO, CPPO, QQ_MANAGER, ADMIN_OPERATION, TRADERS_1-4, JUNIOR_TRADER, TRAFFIC_HEAD, TRAFFIC_TEAM_1-4, ADMIN_MARKETING, QC_MANAGER, QC_ADMIN_1-2, SPV_SOURCING, SOURCING_OFFICER_1-4, STAFF.");

// ===== 7 =====
doc.addPage();y=20;
title("7. API ENDPOINTS");
table(["Endpoint","Deskripsi"],[
  ["/api/auth/[...nextauth]","Login/logout/session"],
  ["/api/chat","AI chatbot (Groq/OpenRouter)"],
  ["/api/chat/history","Chat history per user"],
  ["/api/memory/*","CRUD semua entitas bisnis"],
  ["/api/sheets/*","Google Sheets sync"],
  ["/api/shipments/[id]/risk-analysis","AI risk analysis"],
  ["/api/market-scrape","Market price scraping"],
  ["/api/transcribe","Audio transcription (Whisper)"],
  ["/api/upload","File upload"],
  ["/api/maintenance/sync","Sheets export"],
  ["/api/users","User management"],
  ["/api/whatsapp/send","WhatsApp sender (Twilio)"],
  ["/api/whatsapp/webhook","Twilio webhook"]
]);
h2("MOM Service (External)");
p("Separate Go/Node service untuk Minutes of Meeting. Base: http://localhost:8080. Endpoints: /api/v1/mom/upload-video, /api/v1/mom/jobs/{id}, /api/v1/mom/pdf/{filename}.");

// ===== 8 =====
doc.addPage();y=20;
title("8. INTEGRASI EKSTERNAL");
h2("8.1 Google Sheets (Optional)");
p("Database-First Mode aktif sejak April 2026. Sheets hanya untuk export/backup. Memory B architecture: Web ↔ Database ↔ Sheets.");
gap();
h2("8.2 AI Integration");
bullet("Groq: Chatbot & audio transcription (Whisper)");
bullet("OpenRouter: AI agent, risk analysis, market intelligence");
bullet("Risk Analysis: Analisis cuaca, berita, kondisi laut per shipment");
gap();
h2("8.3 WhatsApp (Twilio)");
p("Notifikasi otomatis via Twilio. Send: /api/whatsapp/send. Webhook: /api/whatsapp/webhook.");
gap();
h2("8.4 Data Migration");
p("Migrasi Excel → DB via scripts/. Sumber: MV_Barge&Source (2021-2024), Daily Delivery (2020-2026). Total: 2,157+ records.");

// ===== 9 =====
doc.addPage();y=20;
title("9. DEPLOYMENT & INFRASTRUCTURE");
h2("9.1 Environment Variables");
table(["Variable","Deskripsi","Status"],[
  ["DATABASE_URL","PostgreSQL (Neon)","Required"],["DIRECT_URL","Direct DB connection","Required"],
  ["NEXTAUTH_SECRET","JWT secret","Required"],["NEXTAUTH_URL","App base URL","Required"],
  ["GROQ_API_KEY","Groq AI key","Optional"],["GOOGLE_SHEETS_ID","Spreadsheet ID","Optional"],
  ["GOOGLE_SHEETS_CREDENTIALS","GCP service account","Optional"]
]);
h2("9.2 Deployment Steps");
bullet("1. git clone + npm install");
bullet("2. .env.example → .env (isi required vars)");
bullet("3. npx prisma generate && npx prisma db push");
bullet("4. npx prisma db seed (optional)");
bullet("5. npm run build");
bullet("6. pm2 start npm --name business-os -- start");
gap();
h2("9.3 Server");
p("Script setup-server.sh: Ubuntu 22/24 LTS, Node 20, PM2, Nginx reverse proxy, UFW firewall, SSL via Certbot.");
p("Production URL: https://production.sangkaraprasetya.site");

// ===== 10 =====
doc.addPage();y=20;
title("10. KEAMANAN");
p("SAST audit 18 Maret 2026: 5 High, 8 Medium, 5 Low findings.");
gap();
h2("10.1 Critical Findings");
table(["#","Temuan","Status"],[
  ["1","Secret exposure di .env (git history)","Rotasi semua secret"],
  ["2","Auto-create CEO tanpa safeguard","FIXED"],
  ["3","Fallback NEXTAUTH_SECRET hardcoded","FIXED"],
  ["4","Path Traversal pada file upload","Perlu perbaikan"],
  ["5","LFI pada transcribe endpoint","Perlu perbaikan"]
],{headColor:[220,38,38]});
h2("10.2 Positif");
bullet("Audit logging konsisten (Prisma transaction)");
bullet("Soft delete (isDeleted)");
bullet("bcrypt password hashing");
bullet("JWT stateless session");
bullet("Prisma ORM (SQL injection prevention)");

// ===== 11 =====
doc.addPage();y=20;
title("11. PANDUAN DEVELOPER BARU");
h2("Prerequisites");
bullet("Node.js v20+, npm, PostgreSQL/Neon, Git");
gap();
h2("Quick Start");
bullet("1. git clone <repo> && npm install");
bullet("2. Copy .env.example → .env");
bullet("3. npx prisma generate && npx prisma db push");
bullet("4. npm run dev → http://localhost:3000");
gap();
h2("Konvensi");
bullet("TypeScript strict mode");
bullet("Zustand: 1 store per domain");
bullet("API: App Router route.ts convention");
bullet("Semua CRUD: include audit logging");
bullet("Soft delete only (isDeleted flag)");
bullet("RBAC check di setiap endpoint & component");
gap();
h2("Key Files");
bullet("src/store/commercial-store.ts (73KB) — master state");
bullet("src/app/page.tsx (98KB) — executive dashboard");
bullet("src/lib/rbac.ts — permission matrix");
bullet("src/lib/auth.ts — NextAuth config");
bullet("prisma/schema.prisma — database schema");

// ===== 12 =====
doc.addPage();y=20;
title("12. KNOWN ISSUES & BACKLOG");
h2("12.1 Known Issues");
table(["Severity","Issue","Action"],[
  ["HIGH","Chat/WhatsApp endpoint tanpa auth","Add session check"],
  ["HIGH","IDOR — no ownership validation","Add ownership check"],
  ["MEDIUM","NEXT_PUBLIC_ API key exposed","Remove prefix"],
  ["MEDIUM","No rate limiting","Add rate limiter"],
  ["MEDIUM","No prompt injection protection","Add sanitization"],
  ["LOW","Market data dari LLM (bukan real API)","Integrate real API"],
  ["LOW","Missing pagination pada beberapa query","Add server-side pagination"]
],{headColor:[220,38,38]});
h2("12.2 Feature Backlog");
bullet("AI Risk Analysis: Real API integration (NewsAPI, Stormglass, BMKG)");
bullet("Row-Level Security per user assignment");
bullet("WebSocket real-time notifications");
bullet("Mobile responsive optimization");
bullet("Automated PDF report generation");
bullet("Integration testing suite");
gap();
p("Untuk pertanyaan teknis, hubungi tim development. Dokumentasi tambahan: RBAC_Documentation.md, REQUIREMENT_SYSTEM_COMPLETE.md, API_USAGE.md, sast_security_report.md.");

// Footers
const total = doc.getNumberOfPages();
for(let i=1;i<=total;i++){doc.setPage(i);addFooter();}

// Save
const buf = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync("HANDOVER_DOCUMENT_BusinessOS.pdf", buf);
console.log(`\n✅ Generated: HANDOVER_DOCUMENT_BusinessOS.pdf`);
console.log(`   Pages: ${total} | Size: ${(buf.length/1024).toFixed(1)} KB`);
