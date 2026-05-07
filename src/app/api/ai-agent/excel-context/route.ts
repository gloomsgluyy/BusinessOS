import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAiRateLimit } from "@/lib/ai-security";
import { canUseAiAssistant } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkbookSummary = {
  fileName: string;
  relativePath: string;
  sheets: Array<{
    name: string;
    rows: number;
    columns: number;
    headers: string[];
    sample: Record<string, unknown>[];
  }>;
};

type ExcelContextCache = {
  expiresAt: number;
  value: WorkbookSummary[] | null;
  pending: Promise<WorkbookSummary[]> | null;
};

declare global {
  var __coaltradeExcelContextCache: ExcelContextCache | undefined;
}

const cache = globalThis.__coaltradeExcelContextCache ?? {
  expiresAt: 0,
  value: null,
  pending: null,
};
globalThis.__coaltradeExcelContextCache = cache;

function findExcelFiles(root: string): string[] {
  const out: string[] = [];
  const allowedDirs = new Set(["Contoh_Excel", "."]);
  const candidates = [
    root,
    path.join(root, "Contoh_Excel"),
  ];

  for (const base of candidates) {
    if (!fs.existsSync(base)) continue;
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) {
        if (allowedDirs.has(entry.name)) out.push(...findExcelFiles(full));
        continue;
      }
      if (/\.(xlsx|xls|csv)$/i.test(entry.name)) out.push(full);
    }
  }

  const uniqueByName = new Map<string, string>();
  for (const file of Array.from(new Set(out))) {
    const key = path.basename(file).toLowerCase();
    const existing = uniqueByName.get(key);
    if (!existing || file.includes(`${path.sep}Contoh_Excel${path.sep}`)) {
      uniqueByName.set(key, file);
    }
  }

  return Array.from(uniqueByName.values()).slice(0, 8);
}

function summarizeWorkbook(filePath: string, root: string): WorkbookSummary {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", dense: false, cellDates: true, sheetRows: 80 });
  return {
    fileName: path.basename(filePath),
    relativePath: path.relative(root, filePath),
    sheets: workbook.SheetNames.slice(0, 12).map((name) => {
      const sheet = workbook.Sheets[name];
      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const rows = range ? range.e.r + 1 : 0;
      const columns = range ? range.e.c + 1 : 0;
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false }).slice(0, 5);
      const headers = json[0] ? Object.keys(json[0]).slice(0, 24) : [];
      return { name, rows, columns, headers, sample: json.slice(0, 3) };
    }),
  };
}

function buildContext() {
  const root = process.cwd();
  const files = findExcelFiles(root);
  return files.flatMap((file) => {
    try {
      return [summarizeWorkbook(file, root)];
    } catch (error) {
      console.warn("[AI Excel Agent] Skipped unreadable workbook:", path.relative(root, file), error);
      return [];
    }
  });
}

async function getCachedContext() {
  const now = Date.now();
  if (cache.value && cache.expiresAt > now) return cache.value;
  if (cache.pending) return cache.pending;

  cache.pending = Promise.resolve()
    .then(() => buildContext())
    .then((value) => {
      cache.value = value;
      cache.expiresAt = Date.now() + 5 * 60 * 1000;
      return value;
    })
    .finally(() => {
      cache.pending = null;
    });

  return cache.pending;
}

function localAnswer(question: string, context: WorkbookSummary[]) {
  const q = question.toLowerCase();
  const hits: string[] = [];
  for (const book of context) {
    for (const sheet of book.sheets) {
      const haystack = `${book.fileName} ${sheet.name} ${sheet.headers.join(" ")}`.toLowerCase();
      if (!q || q.split(/\s+/).some((token) => token.length > 2 && haystack.includes(token))) {
        hits.push(`${book.fileName} / ${sheet.name}: ${sheet.rows} rows, ${sheet.columns} columns. Headers: ${sheet.headers.slice(0, 10).join(", ") || "-"}.`);
      }
    }
  }
  return hits.length
    ? `Context found:\n${hits.slice(0, 8).map((hit) => `- ${hit}`).join("\n")}`
    : "No matching workbook context found yet. Try asking by workbook name, sheet name, buyer, shipment, price, or delivery keyword.";
}

async function aiAnswer(question: string, context: WorkbookSummary[]) {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!groqKey && !openRouterKey) return null;

  const isGroq = Boolean(groqKey);
  const url = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  const apiKey = isGroq ? groqKey : openRouterKey;
  const model = isGroq ? "llama-3.3-70b-versatile" : "meta-llama/llama-3.1-70b-instruct";
  const compact = context.map((book) => ({
    fileName: book.fileName,
    sheets: book.sheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows,
      columns: sheet.columns,
      headers: sheet.headers,
      sample: sheet.sample,
    })),
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "Business OS Excel Agent",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are an Excel context analyst for CoalTradeOS. Answer from workbook metadata and samples only. Say what data is missing when needed.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nWorkbook context:\n${JSON.stringify(compact).slice(0, 20000)}`,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseAiAssistant(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rate = checkAiRateLimit(`excel-context:get:${session.user.id}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many Excel context refreshes. Please retry later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const workbooks = await getCachedContext();
  return NextResponse.json({ success: true, workbooks });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseAiAssistant(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rate = checkAiRateLimit(`excel-context:post:${session.user.id}`, 15, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many Excel AI questions. Please retry later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });
  if (question.length > 1200) return NextResponse.json({ error: "Question is too long" }, { status: 413 });

  const workbooks = await getCachedContext();
  const answer = (await aiAnswer(question, workbooks)) || localAnswer(question, workbooks);
  return NextResponse.json({ success: true, answer, workbooks });
}
