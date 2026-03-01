
import { Task, SalesOrder } from "@/types";

/**
 * Generates a WhatsApp link to share task details or send a reminder.
 * Falls back to "Unknown" if phone number is missing.
 */
export function sendWhatsAppReminder(task: Task, userPhone?: string, userName?: string) {
    const phone = userPhone || "";
    // Format: "Hello [Name], reminder for task: [Title] due on [Date]. Priority: [Priority]. Please check."
    const message = `Hello ${userName || "Team"}, reminder regarding task:
*${task.title}*
Due: ${new Date(task.due_date).toLocaleDateString()}
Priority: ${task.priority.toUpperCase()}
Status: ${task.status.toUpperCase()}

Please update the status. Thanks!`;

    openWhatsApp(phone, message);
}

/**
 * Generates a WhatsApp link to share an invoice/sales order.
 */
export function sendWhatsAppInvoice(order: SalesOrder, clientPhone?: string) {
    const phone = clientPhone || "";
    const message = `Hello ${order.client}, here is your invoice details:
Order: *${order.order_number}*
Amount: Rp ${order.amount.toLocaleString('id-ID')}
Description: ${order.description}
Status: ${order.status.toUpperCase()}

Thank you for your business!`;

    openWhatsApp(phone, message);
}

function openWhatsApp(phone: string, text: string) {
    // Remove non-numeric characters from phone, ensure proper format
    // Assuming phone numbers in DB are like "+62..." or "08..."
    let cleanPhone = phone.replace(/\D/g, "");

    // Auto-fix ID prefixes if needed (08 -> 628)
    if (cleanPhone.startsWith("0")) {
        cleanPhone = "62" + cleanPhone.slice(1);
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(url, "_blank");
}
