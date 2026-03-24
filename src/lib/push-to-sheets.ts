import { google } from 'googleapis';
import { NextResponse } from "next/server";
import prisma from './prisma';

async function getSheets() {
    let credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");

    try {
        // Clean the string (strip potential shell-added quotes)
        credentials = credentials.trim();
        if ((credentials.startsWith("'") && credentials.endsWith("'")) ||
            (credentials.startsWith('"') && credentials.endsWith('"'))) {
            credentials = credentials.substring(1, credentials.length - 1);
        }

        // --- EXTRA ROBUSTNESS ---
        // 1. If there are real newlines inside the JSON string (common copy-paste error),
        //    JSON.parse will fail. We replace them with literal \n.
        // 2. Sometimes \n is literal in the env but should be a real newline for the PEM.
        //    Actually, JSON.parse expects \n as two characters "\\" and "n".

        let sanitized = credentials;

        // If it's not a valid JSON yet, try to escape real newlines and handle shell-escaped quotes
        try {
            JSON.parse(sanitized);
        } catch (initialError: any) {
            // 1. Replace literal newlines and carriage returns
            sanitized = sanitized.trim().replace(/\r/g, '').replace(/\n/g, '\\n');

            // 2. Fix potential shell-added outer quotes again after trim
            if ((sanitized.startsWith("'") && sanitized.endsWith("'")) ||
                (sanitized.startsWith('"') && sanitized.endsWith('"'))) {
                sanitized = sanitized.substring(1, sanitized.length - 1);
            }

            // 3. AGGRESSIVE: Fix illegal backslash escapes (like \F, \X, etc)
            // JSON only allows: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
            // We search for any \ that is NOT followed by one of these and escape the backslash itself.
            sanitized = sanitized.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');

            // 4. Also handle cases where a backslash is at the very end
            if (sanitized.endsWith('\\') && !sanitized.endsWith('\\\\')) {
                sanitized += '\\';
            }
        }

        const credsJson = JSON.parse(sanitized);

        const auth = new google.auth.GoogleAuth({
            credentials: credsJson,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        return google.sheets({ version: "v4", auth });
    } catch (e: any) {
        console.error("[PushService] Critical Error: Failed to parse GOOGLE_SHEETS_CREDENTIALS.");
        console.error(`Error details: ${e.message}`);

        // Find the character at the error position if possible
        const posMatch = e.message.match(/position (\d+)/);
        if (posMatch) {
            const pos = parseInt(posMatch[1]);
            const context = credentials.substring(Math.max(0, pos - 20), Math.min(credentials.length, pos + 20));
            console.error(`Context at error (pos ${pos}): "...${context}..."`);
        }

        throw new Error(`Google Auth Setup Failed: ${e.message}`);
    }
}

export class PushService {
    private static pendingModels: Set<string> = new Set();
    private static debounceTimer: NodeJS.Timeout | null = null;

    /**
     * Debounced push: collects model names and executes a combined push after 5 seconds of inactivity.
     */
    static async debouncedPush(model: string) {
        this.pendingModels.add(model);
        console.log(`[PushService] Queued ${model} for debounced push. Current queue: ${Array.from(this.pendingModels).join(', ')}`);

        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(async () => {
            const modelsToPush = Array.from(this.pendingModels);
            this.pendingModels.clear();
            this.debounceTimer = null;

            console.log(`[PushService] Executing debounced push for models: ${modelsToPush.join(', ')}`);
            for (const m of modelsToPush) {
                try {
                    await this.pushModelToSheets(m);
                } catch (e: any) {
                    console.error(`[PushService] Debounced push failed for ${m}:`, e.message);
                }
            }
        }, 5000);
    }

    static async pushModelToSheets(model: string) {
        console.log(`[PushService] Processing push for model: ${model}`);
        const sheets = await getSheets();
        const sid = process.env.GOOGLE_SHEETS_ID;
        if (!sid) throw new Error("GOOGLE_SHEETS_ID not set");

        try {
            switch (model.toLowerCase()) {
                case 'marketprice':
                    const prices = await prisma.marketPrice.findMany({ where: { isDeleted: false }, orderBy: { date: 'desc' } });
                    if (prices.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty. Safety guard triggered to prevent Sheet wipe.`);
                        return;
                    }
                    const priceRows = prices.map(p => [p.id, p.date.toISOString(), p.ici1, p.ici2, p.ici3, p.ici4, p.ici5, p.newcastle, p.hba, p.source, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Market Price!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Market Price!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: priceRows }
                    });
                    console.log(`[PushService] Successfully pushed ${priceRows.length} MarketPrice records.`);
                    break;

                case 'taskitem':
                    const tasks = await prisma.taskItem.findMany({ where: { isDeleted: false } });
                    if (tasks.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const taskRows = tasks.map(t => [t.id, t.title, t.description, t.status, t.priority, t.assigneeName, t.dueDate ? t.dueDate.toISOString() : "", "", t.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Tasks!A2:I1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Tasks!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: taskRows }
                    });
                    console.log(`[PushService] Successfully pushed ${taskRows.length} TaskItem records.`);
                    break;

                case 'shipmentdetail':
                    const shipments = await prisma.shipmentDetail.findMany({ where: { isDeleted: false } });
                    if (shipments.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const shipmentRows = shipments.map(s => [
                        s.id, s.shipmentNumber, s.dealId, s.status, s.buyer, s.supplier, s.isBlending ? "Yes" : "No", s.iupOp,
                        s.vesselName, s.bargeName, s.loadingPort, s.dischargePort, s.quantityLoaded, s.blDate ? s.blDate.toISOString() : "",
                        s.eta ? s.eta.toISOString() : "", s.salesPrice, s.marginMt, s.picName, s.type, s.milestones, s.createdAt.toISOString(), s.updatedAt.toISOString()
                    ]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Shipments!A2:V1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Shipments!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: shipmentRows }
                    });
                    console.log(`[PushService] Successfully pushed ${shipmentRows.length} ShipmentDetail records.`);
                    break;

                case 'salesorder':
                    const sales = await prisma.salesOrder.findMany({ where: { isDeleted: false } });
                    if (sales.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const salesRows = sales.map(s => [s.id, s.orderNumber, s.createdAt.toISOString(), s.client, s.description, s.amount, s.priority, s.status, s.createdByName, s.imageUrl, s.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sales!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Sales!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: salesRows }
                    });
                    console.log(`[PushService] Successfully pushed ${salesRows.length} SalesOrder records.`);
                    break;

                case 'sourcesupplier':
                    const sources = await prisma.sourceSupplier.findMany({ where: { isDeleted: false } });
                    if (sources.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const sourceRows = sources.map(s => [
                        s.id, s.name, s.region, s.calorieRange, s.gar, s.ts, s.ash, s.tm, s.jettyPort, s.anchorage,
                        s.stockAvailable, s.minStockAlert, s.kycStatus, s.psiStatus, s.fobBargeOnly ? "TRUE" : "FALSE",
                        s.priceLinkedIndex, s.fobBargePriceUsd, s.contractType, s.picName, s.iupNumber, s.updatedAt.toISOString()
                    ]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sources!A2:U1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Sources!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: sourceRows }
                    });
                    console.log(`[PushService] Successfully pushed ${sourceRows.length} SourceSupplier records.`);
                    break;

                case 'qualityresult':
                    const qualities = await prisma.qualityResult.findMany({ where: { isDeleted: false } });
                    if (qualities.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const qualityRows = qualities.map(q => [q.id, q.cargoId, q.cargoName, q.surveyor, q.samplingDate ? q.samplingDate.toISOString() : "", q.gar, q.ts, q.ash, q.tm, q.status, q.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Quality!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Quality!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: qualityRows }
                    });
                    console.log(`[PushService] Successfully pushed ${qualityRows.length} QualityResult records.`);
                    break;

                case 'meetingitem':
                    const meetings = await prisma.meetingItem.findMany({ where: { isDeleted: false } });
                    if (meetings.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const meetingRows = meetings.map(m => [
                        m.id, m.title, m.date ? m.date.toISOString() : "", m.time, m.location, m.status,
                        m.attendees, m.voiceNoteUrl || "", m.momContent || "", m.aiSummary || "",
                        m.createdByName, m.updatedAt.toISOString()
                    ]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Meetings!A2:L1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Meetings!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: meetingRows }
                    });
                    console.log(`[PushService] Successfully pushed ${meetingRows.length} MeetingItem records.`);
                    break;

                case 'purchaserequest':
                    const purchases = await prisma.purchaseRequest.findMany({ where: { isDeleted: false } });
                    if (purchases.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const purchaseRows = purchases.map(p => [p.id, p.requestNumber, p.createdAt.toISOString(), p.category, p.supplier, p.description, p.amount, p.priority, p.status, p.createdByName, p.imageUrl, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Expenses!A2:L1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Expenses!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: purchaseRows }
                    });
                    console.log(`[PushService] Successfully pushed ${purchaseRows.length} PurchaseRequest records.`);
                    break;

                case 'plforecast':
                    const forecasts = await prisma.pLForecast.findMany({ where: { isDeleted: false } });
                    if (forecasts.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const forecastRows = forecasts.map(p => [p.id, p.buyer, p.quantity, p.sellingPrice, p.buyingPrice, p.freightCost, p.otherCost, p.grossProfitMt, p.totalGrossProfit, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "P&L Forecast!A2:J1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "P&L Forecast!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: forecastRows }
                    });
                    console.log(`[PushService] Successfully pushed ${forecastRows.length} PLForecast records.`);
                    break;

                case 'salesdeal':
                    const deals = await prisma.salesDeal.findMany({ where: { isDeleted: false } });
                    if (deals.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const dealRows = deals.map(d => [d.id, d.dealNumber, d.createdAt.toISOString(), d.buyer, d.vesselName || "-", d.quantity, "high", d.status, d.picName || "System", "", d.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sales!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Sales!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: dealRows }
                    });
                    const projectRows = deals.map(d => [d.id, d.buyer, d.buyerCountry, d.type, d.quantity, d.pricePerMt, d.totalValue, d.status, d.vesselName, d.laycanStart ? d.laycanStart.toISOString() : "", d.laycanEnd ? d.laycanEnd.toISOString() : "", d.picName, d.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Projects!A2:M1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Projects!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: projectRows }
                    });
                    console.log(`[PushService] Successfully pushed ${dealRows.length} SalesDeal records to Sales & Projects.`);
                    break;

                case 'partner':
                    const partners = await prisma.partner.findMany({ where: { isDeleted: false } });
                    if (partners.length === 0) {
                        console.warn(`[PushService] Skipping ${model} check: Local DB is empty.`);
                        return;
                    }
                    const partnerRows = partners.map(p => [p.id, p.name, p.type, p.category, p.contactPerson, p.phone, p.email, p.address, p.city, p.country, p.taxId, p.status, p.notes, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Partners!A2:N1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Partners!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: partnerRows }
                    });
                    console.log(`[PushService] Successfully pushed ${partnerRows.length} Partner records.`);
                    break;

                default:
                    console.warn(`[PushService] No push mapping for model: ${model}`);
            }
        } catch (error: any) {
            console.error(`❌ [PushService] PUSH for ${model} failed:`, error.message);
            if (error.status === 429) {
                console.error("!!! GOOGLE SHEETS QUOTA RISK: Action triggered too many requests. Debounce might need tuning.");
            }
            throw error;
        }
    }

    static async pushAllToSheets() {
        console.log("Memory B: Pushing ALL data to Google Sheets (Safe Mode)...");
        const models = [
            'marketPrice', 'taskItem', 'shipmentDetail', 'salesOrder',
            'sourceSupplier', 'qualityResult', 'meetingItem',
            'purchaseRequest', 'pLForecast', 'salesDeal', 'partner'
        ];

        for (const model of models) {
            // Use debounced push to avoid overwhelming API if this is called in a loop
            await this.debouncedPush(model).catch(e => console.error(`Failed pushing ${model}:`, e.message));
        }
        console.log("✅ Memory B ALL PUSH triggered (debouncing).");
    }
}
