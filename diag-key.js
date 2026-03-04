require("dotenv").config();

const raw = process.env.GOOGLE_SHEETS_CREDENTIALS;
if (!raw) { console.error("GOOGLE_SHEETS_CREDENTIALS not set"); process.exit(1); }

// 1. Try to parse as JSON directly
let creds;
try {
    creds = JSON.parse(raw);
    console.log("✅ JSON.parse() direct success");
} catch (e) {
    console.log("❌ Direct JSON.parse failed:", e.message);
    // Attempt sanitize
    let s = raw.trim().replace(/\r/g, '').replace(/\n/g, '\\n').replace(/\\F/g, '\\n').replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
    creds = JSON.parse(s);
    console.log("✅ JSON.parse() after sanitization success");
}

const pk = creds.private_key || "";

// Fix literal \\n to real newlines
const pkFixed = pk.replace(/\\n/g, '\n');

console.log("\n--- PRIVATE KEY DIAGNOSIS ---");
console.log("Raw length:", pk.length);
console.log("Starts with:", JSON.stringify(pk.substring(0, 40)));
console.log("Ends with:", JSON.stringify(pk.substring(pk.length - 40)));
console.log("Contains real newlines:", pk.includes('\n'));
console.log("Contains literal \\\\n:", pk.includes('\\n'));

console.log("\n--- AFTER FIX ---");
console.log("Fixed length:", pkFixed.length);
console.log("Starts with:", pkFixed.substring(0, 60));
console.log("Contains real newlines:", pkFixed.includes('\n'));

// Try to use the key
const { createPrivateKey } = require('crypto');
try {
    createPrivateKey(pkFixed);
    console.log("\n✅ createPrivateKey() SUCCESS — key is valid!");
} catch (e) {
    console.error("\n❌ createPrivateKey() FAILED:", e.message);
    console.log("\nChecking for obvious issues in fixed key...");
    const lines = pkFixed.split('\n');
    console.log("Line count:", lines.length);
    console.log("First line:", lines[0]);
    console.log("Last non-empty line:", lines.filter(l => l.trim()).pop());
}
