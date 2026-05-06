# SYSTEM INSTRUCTION: IMPLEMENT OPERATIONAL RISK ANALYSIS FEATURE

## <objective>
Implement an "Operational Risk Analysis" feature for the Shipment Monitor module. This feature will use an AI Model (e.g., Gemini/OpenAI) to analyze external API data (News, Weather) combined with Shipment data, evaluate the risk, assign a score (0-100), and display it. High-risk shipments must trigger a notification on the admin dashboard.

## <tech_stack>
- Next.js (App Router)
- Prisma ORM (PostgreSQL)
- TypeScript
- Tailwind CSS

---

## <step_1_database_schema>
**Target File:** `prisma/schema.prisma`

**Action:** 
Add the following fields to the `ShipmentDetail` model.
```prisma
model ShipmentDetail {
  // ... existing fields ...
  
  riskScore      Int?      // 0 to 100
  riskLevel      String?   // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  riskReport     String?   // Stringified JSON containing the detailed AI report
  lastAnalyzedAt DateTime?
}
```
**Post-Action:** Run `npx prisma generate` and `npx prisma db push`.

---

## <step_2_backend_api>
**Target File:** `src/app/api/shipments/[id]/risk-analysis/route.ts` (CREATE NEW)

**Action:** Create a Next.js GET or POST route that performs the following sequence:
1. Extract `id` from params.
2. Query the database (`prisma.shipmentDetail.findUnique`) to get shipment data (especially `loadingPort`, `dischargePort`, `product`, `eta`).
3. Fetch Weather Data (Mock this if no API key provided, or use OpenWeatherMap using `loadingPort` and `dischargePort`).
4. Fetch News Data (Mock this or use NewsAPI searching for ship name or port names).
5. Construct a Prompt String for the AI.
   **Prompt Template:**
   ```text
   Analyze the operational risk for the following shipment:
   - Origin: {loadingPort}, Destination: {dischargePort}, Cargo: {product}
   - Weather Data: {weatherData}
   - News/Incidents: {newsData}
   
   Return ONLY a valid JSON object with this exact schema:
   {
     "score": <number 0-100>,
     "level": "<LOW|MEDIUM|HIGH|CRITICAL>",
     "summary": "<short string summarizing the risk>",
     "factors": ["<risk factor 1>", "<risk factor 2>"],
     "recommendations": "<string advising the admin on what to do>"
   }
   ```
6. Call the AI Provider (e.g., `@google/genai` or standard `fetch` to provider).
7. Parse the AI response text into JSON.
8. Update the database (`prisma.shipmentDetail.update`) with `riskScore`, `riskLevel`, `riskReport` (as stringified JSON), and `lastAnalyzedAt`.
9. Return the parsed JSON as the API response.

---

## <step_3_frontend_shipment_detail>
**Target File:** The component rendering the Shipment Details (e.g.,  `src/app/shipment-monitor/[id]/page.tsx` or a child component like `RiskAnalysisTab.tsx`).

**Action:**
1. Create a "Run AI Risk Analysis" Button.
2. onClick -> `fetch('/api/shipments/${id}/risk-analysis')` and set a loading state.
3. Once data is received (or if `shipment.riskReport` already exists on initial load):
   - Parse `shipment.riskReport`.
   - Render a **Score Indicator** (e.g., Circular Progress or progress bar) using color codes: Green (<40), Yellow (40-70), Red (>70).
   - Render the `summary`.
   - Render the `factors` as a bulleted list.
   - Render the `recommendations`.

---

## <step_4_admin_notification_and_sorting>
**Target File 1 (Sorting):** `src/app/shipment-monitor/page.tsx` (or where the list is fetched).
**Action:** Modify the data fetch query to allow sorting by `riskScore: 'desc'`, so admins can see the most risky shipments first.

**Target File 2 (Notifications):** `src/components/layout/AdminHeader.tsx` or `src/app/admin/page.tsx` (Dashboard).
**Action:**
1. Fetch critical shipments from database:
   ```typescript
   const criticalRisks = await prisma.shipmentDetail.findMany({
     where: { 
       riskLevel: 'CRITICAL',
       status: { notIn: ['completed', 'cancelled'] } // Adjust based on actual status enums
     },
     orderBy: { riskScore: 'desc' },
     take: 5
   });
   ```
2. Render a Notification Bell or an Alert Panel displaying these shipments. Include a link to navigate to the specific shipment detail page (`/shipment-monitor/${id}`).

---

## <execution_rules>
- DO NOT hallucinate API keys. Use `process.env`.
- Wrap the AI parsing logic in a `try...catch` block. If the AI returns malformed JSON, handle the error gracefully without crashing the app.
- Provide loading states in the UI while the AI is analyzing (it can take 3-10 seconds).
- Adhere strictly to the existing Tailwind UI/UX patterns (use existing Card, Button, and Badge components if available).
