"use server";

import { appendRow, upsertRow } from "@/lib/google-sheets";
import { SalesOrder, PurchaseRequest } from "@/types";

export async function saveSalesOrderToSheet(order: SalesOrder) {
    try {
        if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) {
            console.log("Google Sheets credentials not set, skipping sync.");
            return;
        }

        const values = [
            order.id,
            order.order_number,
            order.created_at,
            order.client,
            order.description,
            order.amount.toString(),
            order.priority || "medium",
            order.status,
            order.created_by_name,
            order.image_url ? `=IMAGE("${order.image_url}")` : ""
        ];

        await upsertRow("Sales", 0, order.id, values);
        console.log(`Saved Sales Order ${order.order_number} to Google Sheets`);
    } catch (error) {
        console.error("Failed to save Sales Order to Google Sheets:", error);
    }
}

export async function syncAllSalesToSheet(orders: SalesOrder[]) {
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) return;
    console.log(`Syncing ${orders.length} sales orders to sheets...`);
    for (const order of orders) {
        await saveSalesOrderToSheet(order);
    }
}

export async function savePurchaseRequestToSheet(request: PurchaseRequest) {
    try {
        if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) {
            console.log("Google Sheets credentials not set, skipping sync.");
            return;
        }

        const values = [
            request.id,
            request.request_number,
            request.created_at,
            request.category,
            request.supplier || "-",
            request.description,
            request.amount.toString(),
            request.priority || "medium",
            request.status,
            request.created_by_name,
            request.image_url ? `=IMAGE("${request.image_url}")` : ""
        ];

        await upsertRow("Expenses", 0, request.id, values);
        console.log(`Saved Purchase Request ${request.request_number} to Google Sheets`);
    } catch (error) {
        console.error("Failed to save Purchase Request to Google Sheets:", error);
    }
}

export async function syncAllPurchasesToSheet(requests: PurchaseRequest[]) {
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS || !process.env.GOOGLE_SHEETS_ID) return;
    console.log(`Syncing ${requests.length} purchase requests to sheets...`);
    for (const req of requests) {
        await savePurchaseRequestToSheet(req);
    }
}

// Note: syncFromSheet has been moved to sheet-actions.ts for unified logic and robust parsing.
