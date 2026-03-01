"use server";

import { setupSheetValidation } from "@/lib/google-sheets";

export async function triggerSheetValidation() {
    try {
        await setupSheetValidation("Sales", 7); // Status column is H (index 7)
        await setupSheetValidation("Expenses", 8); // Status column is I (index 8)
        return { success: true };
    } catch (error) {
        console.error("Failed to setup sheet validation:", error);
        return { success: false, error: "Failed to setup validation" };
    }
}
