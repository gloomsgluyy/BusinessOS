const fs = require('fs');
const path = require('path');

const jsonFile = process.argv[2] || 'service-account-new.json';
const envFile = '.env';

if (!fs.existsSync(jsonFile)) {
    console.error(`❌ File not found: ${jsonFile}`);
    console.error(`Usage: node update-env.js <service-account.json>`);
    process.exit(1);
}

// Read and validate JSON
const raw = fs.readFileSync(jsonFile, 'utf8');
let creds;
try {
    creds = JSON.parse(raw);
    console.log(`✅ Valid JSON: project_id=${creds.project_id}, client_email=${creds.client_email}`);
} catch (e) {
    console.error('❌ Invalid JSON file:', e.message);
    process.exit(1);
}

// Convert to single-line JSON (safe for .env)
const singleLine = JSON.stringify(creds);

// Read current .env
if (!fs.existsSync(envFile)) {
    console.error('❌ .env file not found in current directory');
    process.exit(1);
}

let envContent = fs.readFileSync(envFile, 'utf8');

// Replace GOOGLE_SHEETS_CREDENTIALS line
const credentialLineRegex = /^GOOGLE_SHEETS_CREDENTIALS=.*$/m;
const newLine = `GOOGLE_SHEETS_CREDENTIALS=${singleLine}`;

if (credentialLineRegex.test(envContent)) {
    envContent = envContent.replace(credentialLineRegex, newLine);
    console.log('✅ Replaced existing GOOGLE_SHEETS_CREDENTIALS in .env');
} else {
    envContent += `\n${newLine}\n`;
    console.log('✅ Added GOOGLE_SHEETS_CREDENTIALS to .env');
}

fs.writeFileSync(envFile, envContent, 'utf8');
console.log('✅ .env file updated successfully!');
console.log('\nNow run: node diag-key.js');
