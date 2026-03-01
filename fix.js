
const fs = require("fs");
let c = fs.readFileSync("src/components/chatbot/ai-chatbot.tsx", "utf8");
c = c.replace(/\\\$/g, "$").replace(/\\`/g, "`");
fs.writeFileSync("src/components/chatbot/ai-chatbot.tsx", c);
console.log("Fixed");

