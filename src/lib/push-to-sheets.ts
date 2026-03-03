import { google } from 'googleapis';
import prisma from './prisma';

async function getSheets() {
    let credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");
    credentials = credentials.trim().replace(/^'([\s\S]*)'$/, '$1').replace(/^"([\s\S]*)"$/, '$1');
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

export class PushService {
    static async pushModelToSheets(model: string) {
        const sheets = await getSheets();
        const sid = process.env.GOOGLE_SHEETS_ID;
        if (!sid) throw new Error("GOOGLE_SHEETS_ID not set");

        try {
            switch (model.toLowerCase()) {
                case 'marketprice':
                    const prices = await prisma.marketPrice.findMany({ where: { isDeleted: false }, orderBy: { date: 'desc' } });
                    const priceRows = prices.map(p => [p.id, p.date.toISOString(), p.ici1, p.ici2, p.ici3, p.ici4, p.ici5, p.newcastle, p.hba, p.source, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Market Price!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Market Price!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: priceRows }
                    });
                    break;

                case 'taskitem':
                    const tasks = await prisma.taskItem.findMany({ where: { isDeleted: false } });
                    const taskRows = tasks.map(t => [t.id, t.title, t.description, t.status, t.priority, t.assigneeName, t.dueDate ? t.dueDate.toISOString() : "", "", t.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Tasks!A2:I1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Tasks!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: taskRows }
                    });
                    break;

                case 'shipmentdetail':
                    const shipments = await prisma.shipmentDetail.findMany({ where: { isDeleted: false } });
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
                    break;

                case 'salesorder':
                    const sales = await prisma.salesOrder.findMany({ where: { isDeleted: false } });
                    const salesRows = sales.map(s => [s.id, s.orderNumber, s.createdAt.toISOString(), s.client, s.description, s.amount, s.priority, s.status, s.createdByName, s.imageUrl, s.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sales!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Sales!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: salesRows }
                    });
                    break;

                case 'sourcesupplier':
                    const sources = await prisma.sourceSupplier.findMany({ where: { isDeleted: false } });
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
                    break;

                case 'qualityresult':
                    const qualities = await prisma.qualityResult.findMany({ where: { isDeleted: false } });
                    const qualityRows = qualities.map(q => [q.id, q.cargoId, q.cargoName, q.surveyor, q.samplingDate ? q.samplingDate.toISOString() : "", q.gar, q.ts, q.ash, q.tm, q.status, q.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Quality!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Quality!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: qualityRows }
                    });
                    break;

                case 'meetingitem':
                    const meetings = await prisma.meetingItem.findMany({ where: { isDeleted: false } });
                    const meetingRows = meetings.map(m => [m.id, m.title, m.date ? m.date.toISOString() : "", m.time, m.location, m.status, m.attendees, m.createdByName, m.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Meetings!A2:I1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Meetings!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: meetingRows }
                    });
                    break;

                case 'purchaserequest':
                    const purchases = await prisma.purchaseRequest.findMany({ where: { isDeleted: false } });
                    const purchaseRows = purchases.map(p => [p.id, p.requestNumber, p.createdAt.toISOString(), p.category, p.supplier, p.description, p.amount, p.priority, p.status, p.createdByName, p.imageUrl, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Expenses!A2:L1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Expenses!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: purchaseRows }
                    });
                    break;

                case 'plforecast':
                    const forecasts = await prisma.pLForecast.findMany({ where: { isDeleted: false } });
                    const forecastRows = forecasts.map(p => [p.id, p.buyer, p.quantity, p.sellingPrice, p.buyingPrice, p.freightCost, p.otherCost, p.grossProfitMt, p.totalGrossProfit, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "P&L Forecast!A2:J1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "P&L Forecast!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: forecastRows }
                    });
                    break;

                case 'salesdeal':
                    const deals = await prisma.salesDeal.findMany({ where: { isDeleted: false } });
                    // Map to 'Sales' sheet columns: ID, Order #, Date, Client, Description, Amount, Priority, Status, Created By
                    const dealRows = deals.map(d => [
                        d.id,
                        d.dealNumber,
                        d.createdAt.toISOString(),
                        d.buyer,
                        d.vesselName || "-",
                        d.quantity,
                        "high",
                        d.status,
                        d.picName || "System",
                        "",
                        d.updatedAt.toISOString()
                    ]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sales!A2:K1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Sales!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: dealRows }
                    });

                    // Also push to 'Projects' as fallback/legacy if needed, but 'Sales' is primary for monitor
                    const projectRows = deals.map(d => [d.id, d.buyer, d.buyerCountry, d.type, d.quantity, d.pricePerMt, d.totalValue, d.status, d.vesselName, d.laycanStart ? d.laycanStart.toISOString() : "", d.laycanEnd ? d.laycanEnd.toISOString() : "", d.picName, d.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Projects!A2:M1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Projects!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: projectRows }
                    });
                    break;

                case 'partner':
                    const partners = await prisma.partner.findMany({ where: { isDeleted: false } });
                    const partnerRows = partners.map(p => [p.id, p.name, p.type, p.category, p.contactPerson, p.phone, p.email, p.address, p.city, p.country, p.taxId, p.status, p.notes, p.updatedAt.toISOString()]);
                    await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Partners!A2:N1000" });
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sid, range: "Partners!A2", valueInputOption: "USER_ENTERED",
                        requestBody: { values: partnerRows }
                    });
                    break;

                default:
                    console.warn(`No push mapping for model: ${model}`);
            }
        } catch (error: any) {
            console.error(`❌ Memory B PUSH for ${model} failed:`, error.message);
            throw error;
        }
    }

    static async pushAllToSheets() {
        console.log("Memory B: Pushing ALL data to Google Sheets...");
        const models = [
            'marketPrice', 'taskItem', 'shipmentDetail', 'salesOrder',
            'sourceSupplier', 'qualityResult', 'meetingItem',
            'purchaseRequest', 'pLForecast', 'salesDeal', 'partner'
        ];

        for (const model of models) {
            await this.pushModelToSheets(model).catch(e => console.error(`Failed pushing ${model}:`, e.message));
        }
        console.log("✅ Memory B ALL PUSH complete.");
    }
}
