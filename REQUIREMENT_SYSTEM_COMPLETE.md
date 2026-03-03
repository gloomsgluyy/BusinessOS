# BREAKDOWN DETAIL REQUIREMENT SYSTEM 🚀

---

## 📌 BAGIAN 1: MEMORY B SYSTEM (Sistem Intermediary)

### 🎯 Tujuan Utama
- **Mencegah error 429** (Rate limit Google Sheets)
- Tidak ada sinkronisasi langsung Web ↔ Google Sheets
- Menggunakan perantara (Memory B) sebagai buffer/cache

### 📊 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                    MEMORY B ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [WEB INTERFACE]                      [GOOGLE SHEETS]        │
│        ↓                                      ↓               │
│        ↓─────────→ [MEMORY B DB] ←───────────↑               │
│        ↑           (SQLite/Prisma)           │               │
│        ←─────────────────────────────────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 SKEMA 1: Web → Memory B → Google Sheet (PUSH DATA)

**Trigger:** Aksi User CRUD - saat user klik SAVE/CREATE/EDIT/DELETE

**Flow:**
```
User Klik Tombol Save/Create/Edit/Delete
    ↓
Data langsung masuk ke Memory B (Database lokal)
    ↓
Event listener mendeteksi perubahan
    ↓
Trigger otomatis menyala
    ↓
Push ALL data Memory B → Google Sheet
```

**Detail Proses:**
1. User melakukan aksi CRUD di website
2. Data langsung disimpan di Memory B (SQLite/Prisma)
3. Trigger event listener mendeteksi perubahan (onChange event)
4. Sistem otomatis push seluruh data Memory B ke Google Sheet
5. Response dikirim kembali ke user (UI ter-update)

**Keuntungan:**
- ✅ Tidak ada multiple requests dalam waktu singkat
- ✅ Mengurangi API calls ke Google Sheets (prevent rate limit)
- ✅ User experience tetap real-time
- ✅ Data lokal instant, Google Sheets eventual consistency

---

### 🔄 SKEMA 2: Google Sheet → Memory B → Web (PULL DATA)

**Trigger:** Interval waktu (setiap 5 detik) - scheduled sync

**Flow:**
```
Every 5 seconds (setInterval)
    ↓
Check Google Sheet untuk perubahan data
    ↓
Fetch ALL data dari Google Sheet
    ↓
Update/Sync Memory B (replace or merge)
    ↓
Web Interface display data dari Memory B (instant)
```

**Detail Proses:**
1. Setiap 5 detik, sistem melakukan polling ke Google Sheet
2. Data dari Google Sheet di-fetch lengkap
3. Disimpan/diupdate di Memory B (sync)
4. Web interface pull data dari Memory B (instant access dari DB lokal)
5. UI ter-update dengan data terbaru dari Google Sheet

**Keuntungan:**
- ✅ Consistent data synchronization
- ✅ Web tidak perlu langsung access Google Sheets
- ✅ Memory B selalu up-to-date
- ✅ Reduce API call frequency

---

### 💾 Database Technology untuk Memory B

**Opsi yang tersedia:**

| Teknologi | Kelebihan | Kekurangan | Rekomendasi |
|-----------|-----------|-----------|------------|
| **SQLite** | Lightweight, offline-first, embedded | Single file, limited concurrent | ✅ Development/Small scale |
| **Prisma** | ORM modern, type-safe, migrations | Learning curve | ✅ Production-ready |
| **PostgreSQL** | Scalable, multi-user, robust | Setup kompleks | Enterprise scale |
| **MongoDB** | Flexible schema, document | Memory intensive | Data unstructured |

**Rekomendasi:** Prisma + SQLite (dev) → Prisma + PostgreSQL (prod)

---

## 👥 BAGIAN 2: CHATBOT SYSTEM (Per User Memory)

### 🎯 Tujuan Utama
- Setiap user memiliki conversation history tersendiri
- **TIDAK ADA data sharing antar user**
- Chat memory 100% isolated per user

### 📋 Requirement Detail

**Skenario Ilustrasi:**

```
USER 1                                    USER 2
├─ Chat History A                         ├─ Chat History X
│  ├─ Q: "Berapa harga ICI 1?"           │  ├─ Q: "Gimana cara reset?"
│  ├─ A: "ICI 1 = $6500"                 │  ├─ A: "Klik reset button"
│  └─ Memory: [ICI, Harga, Tanggal]      │  └─ Memory: [Reset, Panduan]
│                                         │
├─ Chat History B                         ├─ Chat History Y
│  ├─ Q: "Data perbulan?"                 │  ├─ Q: "API key mana?"
│  ├─ A: "Data sudah disimpan..."         │  ├─ A: "Di settings..."
│  └─ Memory: [Data, Bulan, Analytics]    │  └─ Memory: [API, Setting]
│                                         │
└─ TOTAL: 2 chat sessions                └─ TOTAL: 2 chat sessions
   Memory FULLY ISOLATED ✅                 Memory FULLY ISOLATED ✅
```

### 🔐 Data Isolation via Database

**Table Structure:**
```sql
CREATE TABLE user_chats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(255) NOT NULL,
  message_content TEXT NOT NULL,
  role ENUM('user', 'assistant'),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Data Example:**
```
┌────┬─────────┬────────────────────────────────────┐
│ id │ user_id │ message_content                    │
├────┼─────────┼────────────────────────────────────┤
│ 1  │ user_1  │ "Berapa harga ICI 1?"              │
│ 2  │ user_1  │ "ICI 1 = $6500 per tonne"          │
│ 3  │ user_2  │ "Gimana cara reset password?"      │
│ 4  │ user_2  │ "Klik reset di settings..."        │
└────┴─────────┴────────────────────────────────────┘
```

**Query Isolation:**
```sql
-- User 1 request:
SELECT * FROM user_chats WHERE user_id = 'user_1'
Result: rows 1, 2 ✅ (rows 3, 4 NOT included)

-- User 2 request:
SELECT * FROM user_chats WHERE user_id = 'user_2'  
Result: rows 3, 4 ✅ (rows 1, 2 NOT included)
```

### 🧠 Implementation Details

**Backend Function:**
```javascript
// Get all chats for specific user
async getChatsForUser(userId) {
  return await db.userChats.findMany({
    where: { user_id: userId },
    orderBy: { timestamp: 'asc' }
  });
}

// Add new chat message
async addChatMessage(userId, message, role) {
  return await db.userChats.create({
    data: {
      user_id: userId,
      message_content: message,
      role: role, // 'user' atau 'assistant'
      timestamp: new Date()
    }
  });
}
```

**Frontend Implementation:**
```javascript
// Only fetch current logged-in user's chats
const currentUserId = getCurrentUserId();
const userChats = await api.getChatsForUser(currentUserId);
// Display only these chats in UI
```

---

## 💰 BAGIAN 3: MARKET PRICE SYSTEM

### 🎯 Tujuan Utama
1. Full scraping dari source asli (bukan manual input)
2. Setiap harga ada proof/sumber scraping
3. Chart hanya menampilkan data terbaru per hari
4. Data ICI 1-5 dan Newcastle HBA LENGKAP (tidak boleh 0)
5. Reset semua dummy data

---

## 📌 TUGAS TAMBAHAN - DETAILED BREAKDOWN

### Task 1: Reset Harga Market Price

**Action:**
```sql
-- Hapus semua data price
DELETE FROM market_prices;

-- Reset auto-increment
ALTER TABLE market_prices AUTO_INCREMENT = 1;

-- Verify
SELECT COUNT(*) FROM market_prices; -- Must be 0
```

**Result:** Database kosong, siap untuk fresh scraping ✅

---

### Task 2: Full Market Scraping (Bukan Manual)

**Requirement KETAT:**

✅ **Harga HARUS dari scraping source**
- Tidak boleh input manual
- Harus dari API/web scraper yang nyata
- Bukan hardcoded value

✅ **Proof/Bukti Scraping**
- Setiap harga harus ada source URL
- Timestamp kapan di-scrape
- AI menampilkan source dalam output

✅ **Scrape Semua Komoditas (CRITICAL):**
- ICI 1 (target: ~$6500)
- ICI 2 (target: ~$5800)
- ICI 3 (target: ~$5000)
- ICI 4 (target: ~$4200)
- ICI 5 (target: ~$3400)
- Newcastle HBA (target: ~$85-90/tonne)

**Contoh Output AI yang BENAR:**
```
📊 MARKET PRICE UPDATE - LIVE SCRAPING
Timestamp: 2024-01-01 10:30:45 UTC

═══════════════════════════════════════════════════

💎 ICI 1: $6,500/tonne
   ✓ Source: Market Scraper API (CME)
   ✓ Verified: 2024-01-01 10:30:45 UTC
   ✓ Direct API call: api.market.com/ici1/current

💎 ICI 2: $5,800/tonne
   ✓ Source: Trading Platform X
   ✓ Verified: 2024-01-01 10:30:45 UTC
   ✓ Endpoint: platform.x.com/prices/ici2

💎 ICI 3: $5,000/tonne
   ✓ Source: Bloomberg Commodity API
   ✓ Verified: 2024-01-01 10:30:45 UTC
   ✓ Real-time feed: bloomberg.api/commodities

💎 ICI 4: $4,200/tonne
   ✓ Source: Reuters Commodity Feed
   ✓ Verified: 2024-01-01 10:30:45 UTC
   ✓ Live market: reuters.api/commodities/ici4

💎 ICI 5: $3,400/tonne
   ✓ Source: Commodity Exchange Database
   ✓ Verified: 2024-01-01 10:30:45 UTC
   ✓ Live spot price: exchange.api/ici5

⚫ Newcastle HBA: $87.50/tonne
   ✓ Source: Coal Market Scraper
   ✓ Verified: 2024-01-01 10:30:45 UTC
   ✓ Current spot: coalmarket.api/newcastle

═══════════════════════════════════════════════════

✅ ALL 6 COMMODITIES VERIFIED
✅ NO ZERO OR MISSING VALUES
✅ DIRECT SOURCE PROOF PROVIDED
```

**ERROR HANDLING - Jika Ada Yang Missing:**
```
❌ SCRAPING VALIDATION FAILED!

Missing Commodity: ICI 3
Status: ZERO VALUE DETECTED

Action:
1. Reject this scraping batch
2. Log error: "ICI 3 returned 0"
3. Retry automatic (attempt 1/3)
4. Wait 5 seconds
5. Attempt 2...
6. If still fail after 3x: Alert admin
7. Don't insert incomplete data to DB
```

---

### Task 3: Chart Display - Data Deduplication per Hari

**MASALAH yang ingin dihindari:**

❌ **SALAH - Multiple entries untuk 1 hari:**
```
Chart Data (BAD):
─────────────────────────────────
1 March   ICI 1 = $6,500  (scrape 12:00)
1 March   ICI 1 = $6,510  (scrape 12:15)  ← DUPLIKAT!
1 March   ICI 1 = $6,505  (scrape 12:30)  ← DUPLIKAT!
1 March   ICI 1 = $6,520  (scrape 20:00)  ← DUPLIKAT!

Visual Chart Result: 4 data points untuk 1 tanggal (BERANTAKAN) ❌
```

✅ **BENAR - Only latest per hari:**
```
Chart Data (GOOD):
─────────────────────────────────
1 March   ICI 1 = $6,520  (latest - jam 20:00) ✅
2 March   ICI 1 = $6,515  (latest - jam 18:45) ✅
3 March   ICI 1 = $6,525  (latest - jam 15:30) ✅

Visual Chart Result: 1 data point per tanggal (CLEAN) ✅
```

**Database Storage vs Display:**

```
STORED IN DB (All scraping data):
┌──────────┬─────────┬────────┬─────────────┐
│ Commodity│ Date    │ Price  │ Time        │
├──────────┼─────────┼────────┼─────────────┤
│ ICI 1    │1 March  │ 6500   │ 12:00:00    │
│ ICI 1    │1 March  │ 6510   │ 12:15:00    │
│ ICI 1    │1 March  │ 6505   │ 12:30:00    │
│ ICI 1    │1 March  │ 6520   │ 20:00:00    │← LATEST
│ ICI 1    │2 March  │ 6515   │ 18:45:00    │← LATEST
│ ICI 1    │3 March  │ 6525   │ 15:30:00    │← LATEST
└──────────┴─────────┴────────┴─────────────┘

DISPLAYED IN CHART (Only latest per date):
┌──────────┬─────────┬────────┐
│ Commodity│ Date    │ Price  │
├──────────┼─────────┼────────┤
│ ICI 1    │1 March  │ 6520   │ ✅
│ ICI 1    │2 March  │ 6515   │ ✅
│ ICI 1    │3 March  │ 6525   │ ✅
└──────────┴─────────┴────────┘
```

**SQL Query untuk Deduplication:**
```sql
-- Get latest price per date per commodity
SELECT 
  commodity,
  DATE(timestamp) as trading_date,
  price,
  MAX(timestamp) as last_updated,
  source
FROM market_prices
GROUP BY DATE(timestamp), commodity
ORDER BY trading_date DESC, commodity ASC;
```

**JavaScript Implementation:**
```javascript
function getChartData(prices) {
  const grouped = {};
  
  prices.forEach(price => {
    const date = price.timestamp.toDateString();
    const key = `${price.commodity}_${date}`;
    
    // Keep only latest timestamp per commodity per date
    if (!grouped[key] || price.timestamp > grouped[key].timestamp) {
      grouped[key] = price;
    }
  });
  
  return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
}
```

---

### Task 4: Verifikasi Scraping Lengkap (Validation)

**Checklist Komoditas WAJIB ada:**
```
Before INSERT to Database:

☑ ICI 1    - MUST have valid value (not 0, not null)
☑ ICI 2    - MUST have valid value
☑ ICI 3    - MUST have valid value  
☑ ICI 4    - MUST have valid value
☑ ICI 5    - MUST have valid value
☑ Newcastle HBA - MUST have valid value

If ANY missing or 0:
🚨 REJECT this batch
🚨 Log to error tracker
🚨 Retry 3x automatically
🚨 Notify admin if final fail
```

**Validation Function:**
```javascript
function validateScrapedData(scrapedData) {
  const required = [
    'ICI_1',
    'ICI_2', 
    'ICI_3',
    'ICI_4',
    'ICI_5',
    'NEWCASTLE_HBA'
  ];
  
  const errors = [];
  
  for (let commodity of required) {
    const value = scrapedData[commodity];
    
    // Check if exists
    if (value === undefined || value === null) {
      errors.push(`${commodity}: MISSING`);
    }
    
    // Check if zero
    if (value === 0) {
      errors.push(`${commodity}: ZERO VALUE`);
    }
    
    // Check if number
    if (typeof value !== 'number') {
      errors.push(`${commodity}: NOT A NUMBER (got ${typeof value})`);
    }
    
    // Check if positive
    if (value < 0) {
      errors.push(`${commodity}: NEGATIVE VALUE`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`VALIDATION FAILED:\n${errors.join('\n')}`);
  }
  
  return true; // All pass ✅
}
```

**Retry Logic:**
```javascript
async function scrapeWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);
      
      const data = await scrapeMarketPrices();
      validateScrapedData(data); // Will throw if invalid
      
      await db.insertPrices(data);
      console.log(`✅ Success on attempt ${attempt}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in 5 seconds...`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        console.error(`❌ All ${maxRetries} attempts failed!`);
        notifyAdmin(`Scraping failed after ${maxRetries} retries`);
        return false;
      }
    }
  }
}
```

---

### Task 5: Reset Semua Dummy Data

**Execution Steps:**

```
STEP 1: Backup (Optional tapi recommended)
────────────────────────────────────
CREATE TABLE market_prices_backup AS 
SELECT * FROM market_prices;

STEP 2: Hapus Market Price Data
────────────────────────────────────
DELETE FROM market_prices;
ALTER TABLE market_prices AUTO_INCREMENT = 1;

STEP 3: Hapus Chat History (Jika total reset)
────────────────────────────────────
DELETE FROM user_chats;
ALTER TABLE user_chats AUTO_INCREMENT = 1;

STEP 4: Verification
────────────────────────────────────
SELECT COUNT(*) FROM market_prices;    -- Must be 0 ✅
SELECT COUNT(*) FROM user_chats;       -- Must be 0 ✅

STEP 5: Log & Notify
────────────────────────────────────
Log: "Data reset completed successfully"
Status: Ready for fresh data ingestion ✅
```

---

## 🏗️ COMPLETE SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB APPLICATION LAYER                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │   User 1 Interface   │    │   User 2 Interface   │       │
│  │  • Chat Component    │    │  • Chat Component    │       │
│  │  • Price Dashboard   │    │  • Price Dashboard   │       │
│  └──────────┬───────────┘    └──────────┬───────────┘       │
│             │ (Event: SAVE)             │ (Event: SAVE)     │
│             │                           │                   │
│             └──────────────┬────────────┘                   │
│                            │                               │
│        ┌───────────────────▼────────────────┐              │
│        │      MEMORY B SYSTEM LAYER         │              │
│        │  (Prisma + SQLite/PostgreSQL)      │              │
│        │                                    │              │
│        │  ┌──────────────────────────────┐ │              │
│        │  │   DATABASE TABLES:            │ │              │
│        │  │   • user_chats                │ │              │
│        │  │   • market_prices             │ │              │
│        │  │   • user_settings             │ │              │
│        │  │   • price_sources             │ │              │
│        │  └──────────────────────────────┘ │              │
│        │                                    │              │
│        │  ┌──────────────────────────────┐ │              │
│        │  │   EVENT LISTENERS:            │ │              │
│        │  │   • onChange() → PUSH trigger │ │              │
│        │  │   • onDelete() → PUSH trigger │ │              │
│        │  └──────────────────────────────┘ │              │
│        │                                    │              │
│        │  ┌──────────────────────────────┐ │              │
│        │  │   SCHEDULED TASKS:            │ │              │
│        │  │   • PULL every 5 seconds      │ │              │
│        │  │   • Scrape market prices      │ │              │
│        │  │   • Validate data             │ │              │
│        │  └──────────────────────────────┘ │              │
│        │                                    │              │
│        └────────┬──────────────────┬────────┘              │
│                 │                  │                       │
│        PUSH (On demand)    PULL (Every 5s)               │
│                 │                  │                       │
│        ┌────────▼──────┐  ┌─────────▼─────────┐          │
│        │  PUSH MANAGER │  │  PULL MANAGER     │          │
│        │  • Batch data │  │  • Poll API       │          │
│        │  • Format     │  │  • Validate       │          │
│        │  • Upload GS  │  │  • Update Memory  │          │
│        └────────┬──────┘  └─────────┬─────────┘          │
│                 │                  │                       │
└─────────────────┼──────────────────┼─────────────────────┘
                  │                  │
        ┌─────────▼──────┐  ┌─────────▼──────┐
        │  GOOGLE SHEETS │  │ GOOGLE SHEETS  │
        │   API (Push)   │  │   API (Pull)   │
        └────────────────┘  └────────────────┘
              │                    │
              └────────┬───────────┘
                       │
              ┌────────▼──────────┐
              │  GOOGLE SHEETS    │
              │  • Price Data     │
              │  • User Data      │
              │  • Analytics      │
              └───────────────────┘
```

---

## ✅ DETAILED IMPLEMENTATION CHECKLIST

### Phase 1: Database & Memory B Foundation
- [ ] Setup Prisma project
- [ ] Choose database (SQLite for dev, PostgreSQL for prod)
- [ ] Create Prisma schema with models
- [ ] Run migrations
- [ ] Setup connection pooling
- [ ] Test database connection
- [ ] Create seed data (optional)

### Phase 2: PUSH Logic (Web → Memory B → Google Sheets)
- [ ] Create CRUD endpoints
- [ ] Implement event listeners (onChange, onDelete, etc)
- [ ] Create push manager module
- [ ] Setup Google Sheets API authentication
- [ ] Implement batch data formatting
- [ ] Implement push to Google Sheets
- [ ] Add error handling & retry logic
- [ ] Test PUSH flow end-to-end

### Phase 3: PULL Logic (Google Sheets → Memory B → Web)
- [ ] Create pull manager module
- [ ] Setup scheduled job (setInterval 5 seconds)
- [ ] Implement data fetching from Google Sheets
- [ ] Implement data sync to Memory B
- [ ] Implement WebSocket/polling for real-time UI
- [ ] Add conflict resolution strategy
- [ ] Test PULL flow end-to-end
- [ ] Monitor for performance issues

### Phase 4: Chatbot System - User Isolation
- [ ] Create user_chats table schema
- [ ] Implement getUserChats(userId) function
- [ ] Implement addChatMessage(userId, msg, role) function
- [ ] Create chat API endpoints
- [ ] Add user authentication middleware
- [ ] Implement frontend chat component
- [ ] Filter chats by logged-in user
- [ ] Test isolation with multiple users

### Phase 5: Market Price System - Scraping
- [ ] Research market data sources for ICI 1-5 & Newcastle HBA
- [ ] Setup web scraper or API client
- [ ] Implement price fetching for all 6 commodities
- [ ] Create validation function (no zero values)
- [ ] Implement error handling & retry logic (3x)
- [ ] Create proof of source tracking
- [ ] Implement deduplication logic (latest per date)
- [ ] Test scraper completeness (all 6 commodities)
- [ ] Test validation error cases

### Phase 6: Market Price System - Display & Reset
- [ ] Create market_prices database table
- [ ] Create price chart component
- [ ] Implement chart data deduplication
- [ ] Setup scheduled scraping (ex: every hour)
- [ ] Create reset script for market_prices
- [ ] Implement reset endpoint
- [ ] Test chart display with sample data
- [ ] Verify deduplication logic

### Phase 7: Integration Testing
- [ ] Test PUSH + PULL synchronization
- [ ] Test multi-user chat isolation
- [ ] Test market price scraping completeness
- [ ] Test data validation & error handling
- [ ] Load testing (multiple PUSH/PULL operations)
- [ ] Verify no data leakage between users
- [ ] Test Google Sheets API rate limiting handling

### Phase 8: Production Deployment
- [ ] Setup PostgreSQL for production
- [ ] Configure environment variables
- [ ] Setup monitoring & logging
- [ ] Create backup strategy
- [ ] Setup automated recovery
- [ ] Deploy to production environment
- [ ] Monitor performance & errors
- [ ] Create admin dashboard for monitoring

---

## 📚 DATA FLOW TIMELINE - EXAMPLE SCENARIOS

### Scenario A: Single User CRUD Operation

```
T+0s:
  └─ User 1 enters price data
  └─ Clicks SAVE button

T+0.1s:
  └─ PUSH event triggered
  └─ Data validated
  └─ Saved to Memory B (instant)
  └─ Event listener detects change

T+0.2s:
  └─ Background job starts
  └─ Batch all Memory B data
  └─ Format for Google Sheets

T+0.5s:
  └─ Push to Google Sheets API
  └─ Wait for response

T+1s:
  └─ Response received ✅
  └─ Data successfully in Google Sheets
  └─ User sees success message

T+5s:
  └─ PULL interval triggers
  └─ Fetches from Google Sheets
  └─ Validates no changes (since push just happened)
  └─ Memory B already latest

Result: Data synced from Web → Memory B → Google Sheets ✅
```

### Scenario B: Multiple Users Viewing Same Data

```
T+0s:
  └─ User 1 saves price update
  └─ PUSH triggered

T+0.1s:
  └─ Data in Memory B ✅
  └─ User 1 sees update immediately

T+1s:
  └─ Data in Google Sheets ✅

T+5s:
  └─ PULL interval triggers for all users
  └─ Fetches latest from Google Sheets
  └─ Updates Memory B for User 2

T+5.1s:
  └─ User 2's UI refreshed
  └─ User 2 sees User 1's update ✅

Result: Data synchronized across multiple users ✅
```

### Scenario C: Chat History Isolation

```
T+0s:
  └─ User 1 sends: "What's ICI 1 price?"
  └─ Saved to user_chats with user_id = 'user_1'

T+0.1s:
  └─ User 2 loads chat history
  └─ Query: SELECT * WHERE user_id = 'user_2'
  └─ User 1's message NOT included ✅

T+0.5s:
  └─ User 1 receives AI response
  └─ Saved with user_id = 'user_1'

T+1s:
  └─ User 2 receives different AI response
  └─ Saved with user_id = 'user_2'

Result: Each user has completely isolated chat history ✅
```

### Scenario D: Market Price Scraping with Validation

```
T+0s:
  └─ Scheduled scraper starts

T+0.5s:
  └─ Fetch ICI 1-5, Newcastle HBA
  └─ Validation check:
     ICI 1: $6500 ✅
     ICI 2: $5800 ✅
     ICI 3: $5000 ✅
     ICI 4: $4200 ✅
     ICI 5: $3400 ✅
     Newcastle: $87.50 ✅

T+0.6s:
  └─ All validations passed
  └─ Insert to market_prices table
  └─ Store source proof & timestamp

T+1s:
  └─ Chart deduplication logic runs
  └─ Removes duplicates from same date
  └─ Keeps only latest per date
  └─ Updates chart display ✅

Result: Latest prices displayed without duplication ✅
```

---

## 🚨 CRITICAL REQUIREMENTS SUMMARY

### Memory B System
- ✅ PUSH on user CRUD action (not polling)
- ✅ PULL every 5 seconds (scheduled)
- ✅ Use database intermediary (no direct Web↔GS sync)
- ✅ Prevent 429 rate limit errors
- ✅ All data goes through Memory B

### Chatbot System
- ✅ User isolation (filter by user_id)
- ✅ Each user has separate chat history
- ✅ No cross-user data visibility
- ✅ Maintain conversation context per user

### Market Price System
- ✅ Full scraping (not manual input)
- ✅ Proof of source for every price
- ✅ All 6 commodities must be present
- ✅ No zero or null values allowed
- ✅ Validation before database insertion
- ✅ Deduplication: only latest per date in chart
- ✅ AI output includes source information

### Data Reset
- ✅ Delete all market_prices data
- ✅ Reset auto-increment
- ✅ Verify database empty
- ✅ Ready for fresh data

---

## 📞 FINAL STATUS

**✅ DOCUMENTATION COMPLETE**

Semua requirement sudah di-breakdown secara detail dengan:
- Architecture diagrams
- Code examples
- SQL queries
- Flow diagrams
- Validation logic
- Error handling
- Implementation checklist
- Timeline scenarios

**Ready for Development!** 🚀
