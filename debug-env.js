require("dotenv").config();
const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;

console.log("--- GOOGLE_SHEETS_CREDENTIALS DEBUG ---");
if (!credentials) {
    console.error("❌ ERROR: GOOGLE_SHEETS_CREDENTIALS is not defined in .env");
    process.exit(1);
}

console.log(`Length: ${credentials.length} characters`);

try {
    JSON.parse(credentials);
    console.log("✅ SUCCESS: Standard JSON.parse() works!");
} catch (e) {
    console.error("❌ ERROR: Standard JSON.parse() failed.");
    console.error(`Reason: ${e.message}`);

    // Attempt AGGRESSIVE sanitization logic from PushService
    let sanitized = credentials.trim();

    // Fix outer quotes
    if ((sanitized.startsWith("'") && sanitized.endsWith("'")) ||
        (sanitized.startsWith('"') && sanitized.endsWith('"'))) {
        sanitized = sanitized.substring(1, sanitized.length - 1);
    }

    // Fix newlines
    sanitized = sanitized.replace(/\r/g, '').replace(/\n/g, '\\n');

    // Fix illegal backslashes (the "Unexpected token F" fix)
    sanitized = sanitized.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');

    try {
        JSON.parse(sanitized);
        console.log("⚠️  NOTICE: JSON.parse() works ONLY AFTER aggressive sanitization.");
        console.log("This sanitization logic is now included in your production build.");
    } catch (e2) {
        console.error("❌ CRITICAL: Even sanitized JSON fails to parse.");
        console.error(`Reason: ${e2.message}`);

        const posMatch = e2.message.match(/position (\d+)/);
        if (posMatch) {
            const pos = parseInt(posMatch[1]);
            const context = sanitized.substring(Math.max(0, pos - 15), Math.min(sanitized.length, pos + 15));
            console.log(`Context at position ${pos}: "...${context}..."`);
            console.log("               " + " ".repeat(Math.min(pos, 15)) + "^");
        }
    }
}
