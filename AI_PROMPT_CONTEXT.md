# 🤖 AI Handover Context: BusinessOS Next-Phase Development

**Context generated at:** April 2026
**Current Branch:** `pre-production`

Hello fellow AI Agent! Your USER is continuing the development of the **BusinessOS Data Architecture Migration** project (`11GAWE`). Below is everything you need to know to get up to speed instantly without breaking existing patterns.

## 🏗️ 1. Global Architecture & Stack
- **Frontend/Fullstack Framework:** Next.js 14 App Router (`src/app/*`)
- **Styling & UI:** Tailwind CSS v3, Shadcn/UI components (`src/components/ui`), Recharts for analytics.
- **State Management:** Zustand (`src/store/*`) - Every major feature uses a dedicated store for CRUD operations.
- **Database ORM:** Prisma (`prisma/schema.prisma`) connected to a Neon DB (PostgreSQL).
- **Go Backend Sync Engine:** An external Go service (`sinkronisasi_businessOS` repo) runs parallel to this Next.js app. It constantly watches Google Sheets and Syncs/Upserts rows into the Neon Postgres DB. 

## 🔄 2. What Has Just Been Completed
I just finished migrating the heavy Excel-based data architecture into proper Next.js UI tabs and Prisma schemas.
1. **Outstanding Payment Page** (`src/app/outstanding-payment/page.tsx` & `src/store/outstanding-payment-store.ts`)
   - Fully standalone CRUD using Shadcn Modal. Status: Done.
2. **Shipment Monitor - Daily Delivery Tab** (`src/app/shipment-monitor/page.tsx` & `src/store/daily-delivery-store.ts`)
   - Added a robust sub-tab inside Shipment Monitor for "Daily Delivery 2024-2026". It maps tightly to the new `DailyDelivery` Prisma model (a superset of both EXPORT & DOMESTIC fields).
3. **Market Price HPB Calculator** (`src/app/market-price/page.tsx`)
   - Implemented a dual-pane layout. It now features an interactive **HPB Estimation Calculator** using live inputs (`Actual GAR/TM/TS/ASH`) matched against the closest HBA tiers.
4. **Excel Data Migrator** (`scripts/2026_excel_migrator.cjs`)
   - A NodeJS script designed to use `xlsx` and Google Spreadsheets API to parse thousands of legacy Excel rows (`MV_Barge&Source` and `Recap Shipment`) and inject them perfectly mapped into the Master Google Spreadsheet.

## 🎯 3. Your Tasks (Next Steps)
Your primary objective is to assist the USER in successfully executing and verifying Phase 5 (The actual Data Migration).

- [ ] **Task 1: Execute Migration & Go Backend Handshake**
  - Guide the user to run `node scripts/2026_excel_migrator.cjs`. 
  - *Gotcha Warning:* If the Google Sheets API throws "Range/Sheet not found", you must ask the user to verify the exact Tab Names (*e.g.*, `"MV Barge"` or `"Daily Delivery"`) on their Google Sheet and fix the script.
- [ ] **Task 2: UI Stress Test & Fixes**
  - Once the `sinkronisasi_businessOS` Go Engine pulls the data into Postgres, check `/shipment-monitor` and `/outstanding-payment`.
  - Fix any Tailwind layout breaks if the DataTable columns overflow heavily (e.g. adjust horizontal scrolling limits or truncate logic). 
- [ ] **Task 3: Prisma Model Adjustments**
  - If the Go backend logs show mismatched schemas (e.g., trying to parse a floating string to `Float`, or Date parsing failures), adjust `schema.prisma` and re-migrate `npx prisma migrate --name fix-types`. 

> [!IMPORTANT]
> **DO NOT** rewrite any of the Zustand logic or the Prisma Schemas unless explicitly fixing migration errors. The prior structure was meticulously agreed upon. Maintain the `pre-production` branch hygiene.

Proceed by reading the user's immediate prompt. Good luck!
