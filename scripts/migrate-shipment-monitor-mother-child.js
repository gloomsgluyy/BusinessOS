/**
 * Mother-Child shipment migration for Shipment Monitor
 *
 * Source files:
 * - Mother (MV / Project base): Consolidated_MV_Project_Base (Fixed).xlsx
 * - Child details (barge-level): 00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx
 *
 * Usage:
 *   node scripts/migrate-shipment-monitor-mother-child.js
 *   node scripts/migrate-shipment-monitor-mother-child.js --append
 *   node scripts/migrate-shipment-monitor-mother-child.js --mother="C:\\path\\file.xlsx" --child="C:\\path\\00...xlsx"
 */

const path = require("path");
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const RETRYABLE_DB_CODES = new Set(["P1001", "P1017", "P2024"]);

const args = process.argv.slice(2);
const appendMode = args.includes("--append");

function getArg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  if (!hit) return fallback;
  return hit.substring(name.length + 1).replace(/^"|"$/g, "");
}

const DEFAULT_MOTHER_FILE = "C:\\Users\\Glooms\\Downloads\\Consolidated_MV_Project_Base (Fixed).xlsx";
const DEFAULT_CHILD_FILE = path.resolve(process.cwd(), "00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx");

const motherFile = getArg("--mother", DEFAULT_MOTHER_FILE);
const childFile = getArg("--child", DEFAULT_CHILD_FILE);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDbError(error) {
  const code = error?.code;
  const msg = String(error?.message || "").toLowerCase();
  return (
    RETRYABLE_DB_CODES.has(code) ||
    msg.includes("server has closed the connection") ||
    msg.includes("connection") ||
    msg.includes("socket")
  );
}

async function withDbRetry(fn, label, maxAttempts = 6) {
  let attempt = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableDbError(error)) throw error;
      const waitMs = Math.min(12000, 1000 * (2 ** (attempt - 1)));
      console.warn(`Retrying ${label} (attempt ${attempt + 1}/${maxAttempts}) after ${waitMs}ms: ${error?.code || error?.message}`);
      await sleep(waitMs);
      try {
        await prisma.$disconnect();
      } catch (_) {}
      try {
        await prisma.$connect();
      } catch (_) {}
      attempt += 1;
    }
  }
}

function cleanStr(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

function toFloat(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const n = parseFloatLocalized(String(val));
  return Number.isFinite(n) ? n : null;
}

function parseFloatLocalized(raw) {
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s) return NaN;

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    if (commaCount === 1) {
      const parts = s.split(",");
      const left = parts[0] || "";
      const right = parts[1] || "";
      s = right.length <= 2 ? `${left}.${right}` : `${left}${right}`;
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (dotCount > 1) {
    s = s.replace(/\./g, "");
  } else if (dotCount === 1 && commaCount === 0) {
    const parts = s.split(".");
    const left = parts[0] || "";
    const right = parts[1] || "";
    // Indonesian formatted thousands (e.g. 16.300, 77.500) should be 16300 / 77500.
    if (right.length === 3 && left.length >= 1) {
      s = `${left}${right}`;
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function toInt(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null;
  const n = parseInt(String(val).replace(/[^0-9\-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function excelSerialToDate(serial) {
  if (typeof serial !== "number" || serial <= 0) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return Number.isNaN(dateInfo.getTime()) ? null : dateInfo;
}

function parseDate(val, fallbackYear) {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  if (typeof val === "number") return excelSerialToDate(val);
  const raw = String(val).trim();
  if (!raw) return null;

  // Handle compact textual dates without explicit year ("29Nov", "1 Dec")
  // so we can apply sheet year instead of JS default year heuristics.
  const dayMonthOnly = raw.match(/^(\d{1,2})\s*[-\/]?\s*([A-Za-z]{3,})$/);
  if (dayMonthOnly) {
    const day = parseInt(dayMonthOnly[1], 10);
    const monthTxt = dayMonthOnly[2].substring(0, 3).toUpperCase();
    const monthMap = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, MEI: 4, JUN: 5,
      JUL: 6, AUG: 7, AGU: 7, SEP: 8, OCT: 9, OKT: 9, NOV: 10,
      DEC: 11, DES: 11
    };
    if (monthMap[monthTxt] !== undefined && fallbackYear) {
      const d = new Date(fallbackYear, monthMap[monthTxt], day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  // "17 Jan", "17 January", optionally without year
  const m = raw.match(/^(\d{1,2})\s*[-\/]?\s*([A-Za-z]+)(?:\s+(\d{2,4}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthTxt = m[2].substring(0, 3).toUpperCase();
    const yearRaw = m[3] ? parseInt(m[3], 10) : fallbackYear;
    const monthMap = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, MEI: 4, JUN: 5,
      JUL: 6, AUG: 7, AGU: 7, SEP: 8, OCT: 9, OKT: 9, NOV: 10,
      DEC: 11, DES: 11
    };
    if (monthMap[monthTxt] !== undefined && yearRaw) {
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const d = new Date(year, monthMap[monthTxt], day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

function normalizeText(s) {
  return (s || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVesselName(raw) {
  const text = cleanStr(raw);
  if (!text) return null;
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (/^CANCEL(L?ED)?$/i.test(oneLine) || /^TBA$/i.test(oneLine)) return null;
  // Keep only first vessel token for matching; strip trailing "OR SUBS" / "i.o ..."
  return oneLine
    .replace(/\bi\.?o\b.*$/i, "")
    .replace(/\bOR SUBS\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractProjectHint(raw) {
  const s = cleanStr(raw);
  if (!s) return null;
  const m = s.match(/project\s*:\s*([A-Za-z0-9_.\-\/]+)/i);
  if (m) return m[1].trim();
  return null;
}

function statusToInternal(status, shipmentStatus) {
  const src = normalizeText(`${status || ""} ${shipmentStatus || ""}`);
  if (src.includes("CANCEL")) return "cancelled";
  if (src.includes("DONE") || src.includes("COMPLETE") || src.includes("COMPLETELY") || src.includes("DISCHARGED")) return "completed";
  if (src.includes("UPCOMING") || src.includes("WAITING")) return "upcoming";
  if (src.includes("LOADING PROSES") || src.includes("LOADING PROCESS")) return "loading";
  if (src.includes("LOAD")) return "loading";
  if (src.includes("TRANSIT") || src.includes("ANCHORAGE") || src.includes("DISCH")) return "in_transit";
  return "upcoming";
}

function typeFromExportDmo(v) {
  const s = normalizeText(v || "");
  if (s.includes("DMO") || s.includes("DOMESTIC") || s.includes("DOMESTIK") || s.includes("LOCAL")) return "local";
  return "export";
}

function buildMatchKey(year, vessel, project) {
  return [
    year || "X",
    normalizeText(vessel || ""),
    normalizeText(project || "")
  ].join("|");
}

const HEADER_TOKENS = new Set([
  "NO",
  "NO.",
  "STATUS",
  "ORIGIN",
  "MV PROJECT NAME",
  "MV NAME",
  "MV PROJECT",
  "SOURCE",
  "IUP OP",
  "SHIPMENT FLOW",
  "JETTY LOADING PORT",
  "JETTY",
  "LAYCAN",
  "NOMINATION",
  "QTY MT",
  "QTY",
  "PLAN",
  "COB",
  "REMARKS",
  "SHIPMENT STATUS",
  "ISSUE",
  "BL DATE",
  "BUYER",
  "EXPORT",
  "EXPORT DMO"
]);

function isHeaderToken(val) {
  const n = normalizeText(cleanStr(val) || "");
  return !!n && HEADER_TOKENS.has(n);
}

function isChildDataRow(rowText) {
  if (!rowText) return false;
  const t = normalizeText(rowText);
  if (!t) return false;
  if (t.includes("TOTAL")) return false;
  if (t.includes("NO EXPORT / DMO")) return false;
  if (t.includes("SHIPMENT MONITORING")) return false;
  return true;
}

function hasRowDetailSignal(fields) {
  return fields.some((v) => {
    const s = cleanStr(v);
    if (!s) return false;
    const n = normalizeText(s);
    return n !== "0" && n !== "0 JAN" && n !== "0 JANUARY 00";
  });
}

function looksLikeDateText(val) {
  if (val === null || val === undefined || val === "") return false;
  if (typeof val === "number") return val > 20000; // likely Excel serial date
  const s = String(val).trim();
  if (!s) return false;
  if (/^\d{5,}$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n > 20000 && n < 80000) return true; // Excel serial range
  }
  if (/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?$/.test(s)) return true;
  if (/^\d{1,2}\s*[A-Za-z]{3,}(?:\s+\d{2,4})?$/.test(s)) return true;
  if (/^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(s)) return true;
  if (/^[A-Za-z]+\s+\d{1,2},\s*\d{4}$/.test(s)) return true;
  return false;
}

function shouldAttemptDateParse(val) {
  if (val === null || val === undefined || val === "") return false;
  if (typeof val === "number") return true;
  const s = String(val).trim();
  if (!s) return false;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 20000 && n < 80000;
  }
  return true;
}

function buildLegacyHeaderLabels(rows) {
  const h1 = rows[0] || [];
  const h2 = rows[1] || [];
  const maxLen = Math.max(h1.length, h2.length);
  const labels = [];
  for (let c = 0; c < maxLen; c += 1) {
    const a = cleanStr(h1[c]);
    const b = cleanStr(h2[c]);
    const combined = [a, b].filter(Boolean).join(" > ");
    labels.push(combined || null);
  }
  return labels;
}

function findCols(headers, patterns) {
  const out = [];
  for (let i = 0; i < headers.length; i += 1) {
    const h = normalizeText(headers[i] || "");
    if (!h) continue;
    if (patterns.some((p) => p.test(h))) out.push(i);
  }
  return out;
}

function scoreDateDensity(rows, colIdx, fallbackYear) {
  if (colIdx < 0) return 0;
  let hit = 0;
  let seen = 0;
  for (let r = 2; r < Math.min(rows.length, 200); r += 1) {
    const raw = rows[r]?.[colIdx];
    if (raw === null || raw === undefined || raw === "") continue;
    seen += 1;
    if (parseDate(raw, fallbackYear)) hit += 1;
  }
  return seen === 0 ? 0 : hit / seen;
}

function scoreStatusDensity(rows, colIdx) {
  if (colIdx < 0) return 0;
  let hit = 0;
  let seen = 0;
  for (let r = 2; r < Math.min(rows.length, 200); r += 1) {
    const raw = cleanStr(rows[r]?.[colIdx]);
    if (!raw) continue;
    seen += 1;
    const t = normalizeText(raw);
    if (
      t.includes("DONE") ||
      t.includes("COMPLETE") ||
      t.includes("UPCOMING") ||
      t.includes("WAITING") ||
      t.includes("LOAD") ||
      t.includes("DISCH")
    ) {
      hit += 1;
    }
  }
  return seen === 0 ? 0 : hit / seen;
}

function scoreNumericDensity(rows, colIdx, min = 0, max = Number.POSITIVE_INFINITY) {
  if (colIdx < 0) return 0;
  let hit = 0;
  let seen = 0;
  for (let r = 2; r < Math.min(rows.length, 300); r += 1) {
    const raw = rows[r]?.[colIdx];
    if (raw === null || raw === undefined || raw === "") continue;
    seen += 1;
    const n = toFloat(raw);
    if (n !== null && n > min && n < max) hit += 1;
  }
  return seen === 0 ? 0 : hit / seen;
}

function pickBestIndex(candidates, scoreFn) {
  if (!candidates || candidates.length === 0) return -1;
  let bestIdx = candidates[0];
  let bestScore = scoreFn(bestIdx);
  for (let i = 1; i < candidates.length; i += 1) {
    const idx = candidates[i];
    const sc = scoreFn(idx);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

function pickFirstNumber(row, indexes) {
  for (const idx of indexes) {
    if (idx === null || idx === undefined || idx < 0) continue;
    const n = toFloat(row[idx]);
    if (n !== null && n > 0) return n;
  }
  return null;
}

function asPlausibleUsdPerMt(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n >= 5 && n <= 250 ? n : null;
}

function asPlausibleMarginUsd(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n >= -100 && n <= 100 ? n : null;
}

function isLegacyMilestoneHeader(label) {
  const h = normalizeText(label || "");
  if (!h) return false;
  if (h === "BL DATE") return true;
  return /(DATE|ARRIVAL|BERTHING|LOAD|DISCH|INPOSITION|LHV|COA|SUBMIT|APPROVAL|PAID|RECEIVE|ISSUED|TARGET|LATEST|SENT)/.test(h);
}

function milestoneRowsFromLegacy(row, year, sheetName, colMap, headerLabels) {
  const milestones = [];
  const seen = new Set();
  const pushMilestone = (title, rawDate, sequence, strictDateText = true) => {
    if (strictDateText) {
      if (!looksLikeDateText(rawDate)) return;
    } else if (!shouldAttemptDateParse(rawDate) && !looksLikeDateText(rawDate)) {
      return;
    }
    const date = parseDate(rawDate, year);
    if (!date) return;
    const key = `${title}|${date.toISOString()}`;
    if (seen.has(key)) return;
    seen.add(key);
    milestones.push({
      title,
      date,
      description: `Imported from ${sheetName}`,
      _sequence: sequence
    });
  };

  pushMilestone("BL Date", row[colMap.blDate], 10, false);

  for (let c = 0; c < row.length; c += 1) {
    if (c === colMap.blDate) continue;
    const label = headerLabels[c];
    if (!isLegacyMilestoneHeader(label)) continue;
    const title = cleanStr(label) || `Milestone C${c + 1}`;
    pushMilestone(title, row[c], 100 + c, true);
  }

  return milestones.sort((a, b) => a._sequence - b._sequence);
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const r = rows[i] || [];
    const txt = normalizeText(r.join(" | "));
    if (txt.includes("MV PROJECT NAME") && txt.includes("NOMINATION") && txt.includes("QTY MT")) {
      return i;
    }
  }
  return -1;
}

function isLikelyHeaderContinuationRow(row) {
  if (!row) return false;
  const cells = row.map((v) => cleanStr(v)).filter(Boolean);
  if (cells.length === 0) return false;

  const text = normalizeText(cells.join(" | "));
  if (!text) return false;

  // If the row already looks like a shipment line (starts with number and has vessel/project words),
  // treat as data, not header continuation.
  const first = cleanStr(row[0]);
  if (typeof row[0] === "number" || /^\d+$/.test(String(first || ""))) {
    if (/(MV|PROJECT|TB|BG|DONE|UPCOMING|FOB|CIF)/.test(text)) return false;
  }

  if (/(TB|BG|OR SUBS|DONE SHIPMENT|UPCOMING SHIPMENT)/.test(text)) return false;

  return /(PLAN|JETTY|TERM|INVOICE|APPROVAL|PAID|PRICE|MARKET|BASE|DEVIASI|COMPARISON|OPS|QA|LEGAL|TANGGAL|JAM|SOURCE|CONTRACT|KURS|IDR|USD|TRACKKER|BILLING|ROYALTI)/.test(text);
}

function detectHeaderDepth(rows, headerRow) {
  const r2 = rows[headerRow + 2] || [];
  return isLikelyHeaderContinuationRow(r2) ? 3 : 2;
}

function buildMergedHeaders(rows, headerRow, depth = 3) {
  const r1 = rows[headerRow] || [];
  const r2 = rows[headerRow + 1] || [];
  const r3 = depth >= 3 ? (rows[headerRow + 2] || []) : [];
  const maxLen = Math.max(r1.length, r2.length, r3.length || 0);
  const out = [];
  for (let c = 0; c < maxLen; c += 1) {
    const parts = [r1[c], r2[c], depth >= 3 ? r3[c] : null]
      .map((v) => cleanStr(v))
      .filter(Boolean);
    out.push(parts.join(" > "));
  }
  return out;
}

function findCol(headers, patterns) {
  for (let i = 0; i < headers.length; i += 1) {
    const h = normalizeText(headers[i] || "");
    if (!h) continue;
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

function milestoneRowsFromChild(row, idx, year, sourceSheet) {
  const milestones = [];
  const add = (label, value, sequence, description) => {
    const d = parseDate(value, year);
    if (!d) return;
    milestones.push({
      title: label,
      date: d,
      description: description || `Imported from ${sourceSheet}`,
      _sequence: sequence
    });
  };

  add("Arrival POL", row[idx.arrivalPol], 10);
  add("Berthing", row[idx.berthing], 20);
  add("Comm Load", row[idx.commLoad], 30);
  add("Comp Load", row[idx.compLoad], 40);
  add("Issued LHV", row[idx.issuedLhv], 50);
  add("Arrival POD", row[idx.arrivalPod], 60);
  add("Inposition", row[idx.inposition], 70);
  add("Comm Disch", row[idx.commDisch], 80);
  add("Comp Disch", row[idx.compDisch], 90);
  add("BL Date", row[idx.blDate], 100);
  add("Sent To Supplier", row[idx.sentToSupplier], 110);
  add("Sent To Barge Owner", row[idx.sentToBargeOwner], 120);
  add("COA Date", row[idx.coaDate], 130);

  return milestones.sort((a, b) => a._sequence - b._sequence);
}

function legacyColumnMap(year, rows, headers) {
  // Static fallback map (used when legacy headers are inconsistent)
  const map = (year === 2023)
    ? {
      no: 0,
      mvProjectName: 1,
      laycan: 2,
      buyer: 3,
      iupOp: 4,
      source: 7,
      jettyLoadingPort: 11,
      nomination: 13,
      qtyPlan: 14,
      qtyCob: 15,
      qtyLoaded: 15,
      shipmentStatus: 19,
      surveyorLhv: 20,
      blDate: 22,
      sp: 24,
      deadfreight: 26,
      lossGainCargo: 23
    }
    : (year === 2022)
      ? {
        no: 1,
        mvProjectName: 2,
        laycan: 3,
        buyer: 4,
        iupOp: 5,
        source: 7,
        jettyLoadingPort: 9,
        nomination: 10,
        qtyPlan: 12,
        qtyCob: 13,
        qtyLoaded: 14,
        shipmentStatus: 15,
        blDate: 16,
        sp: 19,
        deadfreight: 20,
        lossGainCargo: 18
      }
      : {
        no: 1,
        mvProjectName: 2,
        laycan: 3,
        buyer: 5,
        iupOp: 10,
        source: 11,
        jettyLoadingPort: 12,
        nomination: 13,
        qtyPlan: 14,
        qtyCob: 15,
        qtyLoaded: 15,
        shipmentStatus: 16,
        blDate: 17,
        sp: 6,
        deadfreight: 9,
        lossGainCargo: 8
      };

  if (!headers || headers.length === 0) return map;

  const normLabel = (idx) => normalizeText(headers[idx] || "");
  const firstNonContract = (arr) => arr.find((idx) => !normLabel(idx).includes("CONTRACT")) ?? arr[0];
  const preferActual = (arr) => arr.find((idx) => normLabel(idx).includes("ACTUAL")) ?? arr[0];

  const noCols = findCols(headers, [/^NO$/, /^NO\.$/]);
  if (noCols.length > 0) map.no = pickBestIndex(noCols, (idx) => scoreNumericDensity(rows, idx, 0, 10000));

  const mvCols = findCols(headers, [/MV\s+NAME/, /MV\s+PROJECT\s+NAME/]);
  if (mvCols.length > 0) map.mvProjectName = mvCols[0];

  const laycanCols = findCols(headers, [/^LAYCAN$/]);
  if (laycanCols.length > 0) map.laycan = laycanCols[0];

  const buyerCols = findCols(headers, [/^BUYER$/]);
  if (buyerCols.length > 0) map.buyer = buyerCols[0];

  const iupCols = findCols(headers, [/^IUP\s+OP$/]);
  if (iupCols.length > 0) map.iupOp = iupCols[0];

  const sourceCols = findCols(headers, [/^SOURCE$/, /SOURCE\s+CONTRACT/]);
  if (sourceCols.length > 0) map.source = firstNonContract(sourceCols);

  const jettyCols = findCols(headers, [/^JETTY$/, /JETTY\s+ACTUAL/, /LOADING\s+PORT/]);
  if (jettyCols.length > 0) map.jettyLoadingPort = preferActual(jettyCols);

  const nominationCols = findCols(headers, [/NOMINATION/]);
  if (nominationCols.length > 0) map.nomination = nominationCols[0];

  const qtyPlanCols = findCols(headers, [/QTY.*PLAN/]);
  if (qtyPlanCols.length > 0) map.qtyPlan = pickBestIndex(qtyPlanCols, (idx) => scoreNumericDensity(rows, idx, 0, 100000));

  const qtyCobCols = findCols(headers, [/STOCK\s+JETTY/, /\bCOB\b/]);
  if (qtyCobCols.length > 0) map.qtyCob = pickBestIndex(qtyCobCols, (idx) => scoreNumericDensity(rows, idx, 0, 100000));

  const qtyLoadedCols = findCols(headers, [/BL\s+QUANTITY/, /QTY.*BARGE/, /^DSR$/, /QTY.*ACTUAL/]);
  if (qtyLoadedCols.length > 0) map.qtyLoaded = pickBestIndex(qtyLoadedCols, (idx) => scoreNumericDensity(rows, idx, 0, 100000));

  const statusCols = findCols(headers, [/^STATUS$/, /SHIPMENT\s+STATUS/]);
  if (statusCols.length > 0) map.shipmentStatus = pickBestIndex(statusCols, (idx) => scoreStatusDensity(rows, idx));

  const blDateCols = findCols(headers, [/BL\s+DATE/]).filter((idx) => !normLabel(idx).includes("SOURCE CONTRACT"));
  if (blDateCols.length > 0) map.blDate = pickBestIndex(blDateCols, (idx) => scoreDateDensity(rows, idx, year));

  const surveyorCols = findCols(headers, [/SURVEYOR\s+LHV/]);
  if (surveyorCols.length > 0) map.surveyorLhv = surveyorCols[0];

  const spCols = findCols(headers, [/^SP$/]);
  if (spCols.length > 0) map.sp = pickBestIndex(spCols, (idx) => scoreNumericDensity(rows, idx, 0, 1000000));

  const deadfreightCols = findCols(headers, [/DEADFREIGHT/]);
  if (deadfreightCols.length > 0) map.deadfreight = deadfreightCols[0];

  const lossGainCols = findCols(headers, [/LOSS.*GAIN/]);
  if (lossGainCols.length > 0) map.lossGainCargo = lossGainCols[0];

  return map;
}

async function migrateLegacySheet(rows, year, sheetName, motherIndex) {
  const legacyHeaders = buildLegacyHeaderLabels(rows);
  const col = legacyColumnMap(year, rows, legacyHeaders);
  console.log(`  legacy-map ${sheetName} => no:${col.no} mv:${col.mvProjectName} laycan:${col.laycan} qtyPlan:${col.qtyPlan} qtyCob:${col.qtyCob} qtyLoaded:${col.qtyLoaded} status:${col.shipmentStatus} blDate:${col.blDate} sp:${col.sp}`);
  let inserted = 0;
  let milestones = 0;
  const carry = {
    mvProjectName: null,
    laycan: null
  };

  for (let r = 2; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const line = row.map((v) => (v == null ? "" : String(v))).join(" | ");
    if (!isChildDataRow(line)) continue;

    const no = toInt(row[col.no]);
    const mvRaw = cleanStr(row[col.mvProjectName]);
    const laycanRaw = cleanStr(row[col.laycan]);
    if (mvRaw) carry.mvProjectName = mvRaw;
    if (laycanRaw) carry.laycan = laycanRaw;

    const mvProjectName = mvRaw || carry.mvProjectName;
    const nomination = cleanStr(row[col.nomination]);
    const sourceRaw = cleanStr(row[col.source]);
    const iupRaw = cleanStr(row[col.iupOp]);
    const jettyRaw = cleanStr(row[col.jettyLoadingPort]);
    const shipmentStatusRaw = cleanStr(row[col.shipmentStatus]);
    const mvNorm = normalizeText(mvProjectName || "");
    const nomNorm = normalizeText(nomination || "");
    if (
      isHeaderToken(mvProjectName) ||
      isHeaderToken(nomination) ||
      isHeaderToken(sourceRaw) ||
      isHeaderToken(shipmentStatusRaw) ||
      mvNorm === "MV NAME" ||
      mvNorm === "MV PROJECT NAME" ||
      nomNorm === "NOMINATION"
    ) continue;
    if (!no && !mvProjectName && !nomination) continue;
    if (
      !no &&
      !hasRowDetailSignal([nomination, sourceRaw, iupRaw, jettyRaw, shipmentStatusRaw])
    ) continue;

    const vesselHint = normalizeVesselName(mvProjectName || nomination);
    let mother = null;
    if (vesselHint) {
      const vesselNorm = normalizeText(vesselHint);
      mother = [...motherIndex.values()].find((m) => m.year === year && m.vesselNorm && (m.vesselNorm.includes(vesselNorm) || vesselNorm.includes(m.vesselNorm)));
    }

    const qtyPlan = toFloat(row[col.qtyPlan]);
    const qtyCob = pickFirstNumber(row, [col.qtyCob, col.qtyLoaded, col.qtyPlan]);
    const quantityLoaded = pickFirstNumber(row, [col.qtyLoaded, col.qtyCob, col.qtyPlan]);
    const spRaw = toFloat(row[col.sp]);
    const spPlausible = spRaw && spRaw > 0 && spRaw < 500 ? spRaw : null;
    const lossGainCargo = toFloat(row[col.lossGainCargo]);
    const deadfreight = toFloat(row[col.deadfreight]);

    const shipment = await withDbRetry(() => prisma.shipmentDetail.create({
      data: {
        no,
        exportDmo: "EXPORT",
        status: statusToInternal(cleanStr(row[col.shipmentStatus]), cleanStr(row[col.shipmentStatus])),
        origin: mother?.area || null,
        mvProjectName,
        source: sourceRaw,
        iupOp: iupRaw,
        jettyLoadingPort: jettyRaw || mother?.pol || null,
        laycan: laycanRaw || carry.laycan || mother?.laycan || null,
        nomination,
        qtyPlan,
        qtyCob,
        shipmentStatus: cleanStr(row[col.shipmentStatus]),
        blDate: parseDate(row[col.blDate], year),
        surveyorLhv: cleanStr(row[col.surveyorLhv]),
        lossGainCargo,
        deadfreight,
        sp: spPlausible,
        buyer: cleanStr(row[col.buyer]) || mother?.buyer || null,
        vesselName: mother?.vessel || vesselHint || mvProjectName || null,
        bargeName: nomination,
        loadingPort: jettyRaw || mother?.pol || null,
        quantityLoaded,
        salesPrice: spPlausible || null,
        product: mother?.product || null,
        type: "export",
        year
      }
    }), "shipmentDetail.create(legacy)");
    inserted += 1;

    const rowMilestones = milestoneRowsFromLegacy(row, year, sheetName, col, legacyHeaders);
    if (rowMilestones.length > 0) {
      const created = await withDbRetry(() => prisma.timelineMilestone.createMany({
        data: rowMilestones.map((m) => ({
          shipmentId: shipment.id,
          title: m.title,
          date: m.date,
          description: m.description
        }))
      }), "timelineMilestone.createMany(legacy)");
      milestones += created.count;
    }
  }

  return { inserted, milestones };
}

async function migrate() {
  console.log("===============================================");
  console.log("MIGRATING SHIPMENT MONITOR (MOTHER + CHILD)");
  console.log("===============================================");
  console.log(`Mother file: ${motherFile}`);
  console.log(`Child file : ${childFile}`);
  console.log(`Mode       : ${appendMode ? "append" : "replace"}`);

  const motherWb = xlsx.readFile(motherFile);
  const motherSheet = motherWb.Sheets[motherWb.SheetNames[0]];
  const motherRows = xlsx.utils.sheet_to_json(motherSheet, { defval: null });

  const childWb = xlsx.readFile(childFile, { cellDates: true });
  const childSheetNames = childWb.SheetNames.filter((n) => /MV_Barge&Source\s*20\d{2}/i.test(n));

  if (!appendMode) {
    console.log("Cleaning shipment tables...");
    await withDbRetry(() => prisma.timelineMilestone.deleteMany({}), "timelineMilestone.deleteMany");
    await withDbRetry(() => prisma.shipmentDetail.deleteMany({}), "shipmentDetail.deleteMany");
    await withDbRetry(() => prisma.dailyDelivery.deleteMany({}), "dailyDelivery.deleteMany");
  }

  console.log(`Loading mother rows: ${motherRows.length}`);
  const motherIndex = new Map();
  let motherInserted = 0;

  for (const raw of motherRows) {
    const year = toInt(raw.Year);
    const vessel = cleanStr(raw.Vessel_Nomination);
    const project = cleanStr(raw.Project);
    const buyer = cleanStr(raw.Buyer);
    if (!year || !vessel || !project) continue;

    const reportType = String(cleanStr(raw.Shipment_Type) || "EXPORT").toUpperCase().includes("DOM")
      ? "domestic"
      : "export";

    const mother = await withDbRetry(() => prisma.dailyDelivery.create({
      data: {
        reportType,
        year,
        shipmentStatus: cleanStr(raw.Status),
        buyer,
        pol: cleanStr(raw.POL),
        laycanPol: cleanStr(raw.Laycan),
        shippingTerm: cleanStr(raw.Shipping_Term),
        area: cleanStr(raw.Area),
        mvBargeNomination: vessel,
        project,
        flow: cleanStr(raw.Flow),
        product: cleanStr(raw.Product),
        blQuantity: toFloat(raw.Total_Quantity),
        analysisMethod: cleanStr(raw.Sheet_Source),
        issue: `Mother shipment base (Record_ID: ${cleanStr(raw.Record_ID) || "-"})`
      }
    }), "dailyDelivery.create");

    const key = buildMatchKey(year, normalizeVesselName(vessel), project);
    motherIndex.set(key, {
      id: mother.id,
      year,
      vessel,
      vesselNorm: normalizeText(normalizeVesselName(vessel)),
      project,
      projectNorm: normalizeText(project),
      buyer,
      flow: cleanStr(raw.Flow),
      pol: cleanStr(raw.POL),
      laycan: cleanStr(raw.Laycan),
      shippingTerm: cleanStr(raw.Shipping_Term),
      area: cleanStr(raw.Area),
      product: cleanStr(raw.Product),
      totalQty: toFloat(raw.Total_Quantity)
    });
    motherInserted += 1;
  }

  console.log(`Inserted mother rows: ${motherInserted}`);
  console.log(`Scanning child sheets: ${childSheetNames.join(", ")}`);

  let childInserted = 0;
  let milestoneInserted = 0;

  for (const sheetName of childSheetNames) {
    const yearMatch = sheetName.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const ws = childWb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    const headerRow = findHeaderRow(rows);
    if (headerRow < 0) {
      if (year && year <= 2023) {
        const legacy = await migrateLegacySheet(rows, year, sheetName, motherIndex);
        childInserted += legacy.inserted;
        milestoneInserted += legacy.milestones;
        console.log(`- ${sheetName}: inserted ${legacy.inserted} legacy child rows`);
      } else {
        console.log(`- ${sheetName}: skipped (header not found)`);
      }
      continue;
    }

    const headerDepth = detectHeaderDepth(rows, headerRow);
    const headers = buildMergedHeaders(rows, headerRow, headerDepth);
    const idx = {
      no: findCol(headers, [/^NO$/]),
      exportDmo: findCol(headers, [/EXPORT\s+DMO/]),
      status: findCol(headers, [/^STATUS$/]),
      origin: findCol(headers, [/^ORIGIN$/]),
      mvProjectName: findCol(headers, [/MV\s+PROJECT\s+NAME/]),
      source: findCol(headers, [/^SOURCE$/]),
      iupOp: findCol(headers, [/IUP\s+OP/]),
      shipmentFlow: findCol(headers, [/SHIPMENT\s+FLOW/]),
      jettyLoadingPort: findCol(headers, [/JETTY\s+LOADING\s+PORT/]),
      laycan: findCol(headers, [/^LAYCAN$/]),
      nomination: findCol(headers, [/^NOMINATION$/]),
      qtyPlan: findCol(headers, [/QTY\s+MT\s+PLAN/, /^QTY\s+MT$/]),
      qtyCob: findCol(headers, [/^COB$/, /^COB\s+JETTY$/, /QTY\s+MT\s+JETTY/]),
      remarks: findCol(headers, [/^REMARKS$/]),
      shipmentStatus: findCol(headers, [/SHIPMENT\s+STATUS/]),
      issue: findCol(headers, [/^ISSUE/, /ISSUE\s+NOTES/]),
      blDate: findCol(headers, [/BL\s+DATE/]),
      shippingTerm: findCol(headers, [/^SHIPPING$/, /TERM$/]),
      noSpal: findCol(headers, [/NO\s+SPAL/]),
      noSi: findCol(headers, [/NO\s+SI/]),
      sentToSupplier: findCol(headers, [/SENT\s+TO\s+SUPPLIER/]),
      sentToBargeOwner: findCol(headers, [/SENT\s+TO\s+BARGE\s+OWNER/]),
      coaDate: findCol(headers, [/COA\s+DATE/]),
      resultGar: findCol(headers, [/RESULT.*GAR/]),
      surveyorLhv: findCol(headers, [/SURVEYOR\s+LHV/]),
      completelyLoaded: findCol(headers, [/COMPLETELY\s+LOADED/]),
      lhvTerbit: findCol(headers, [/LHV\s+TERBIT/]),
      jarak: findCol(headers, [/JARAK/]),
      sp: findCol(headers, [/\bSP\b/]),
      marketPriceUsd: findCol(headers, [/IN\s+USD.*MARKET\s+PRICE/, /MARKET\s+PRICE.*IN\s+USD/]),
      marketPriceIdr: findCol(headers, [/IN\s+IDR.*MARKET\s+PRICE/, /MARKET\s+PRICE.*IDR/]),
      kurs: findCol(headers, [/KURS/, /EST\s+KURS/]),
      basePriceIdr: findCol(headers, [/BASE\s+PRICE/]),
      priceAfterAdjustment: findCol(headers, [/PRICE\s+AFTER\s+ADJUST/]),
      priceComparison: findCol(headers, [/PRICE\s+COMPARISON/]),
      deadfreight: findCol(headers, [/DEADFREIGHT/]),
      arrivalPol: findCol(headers, [/ARRIVAL\s+POL/]),
      berthing: findCol(headers, [/BERTHING/]),
      commLoad: findCol(headers, [/COMM\s+LOAD/]),
      compLoad: findCol(headers, [/COMP\s+LOAD/]),
      issuedLhv: findCol(headers, [/ISSUED\s+LHV/]),
      arrivalPod: findCol(headers, [/ARRIVAL\s+POD/]),
      inposition: findCol(headers, [/INPOSITION/]),
      commDisch: findCol(headers, [/COMM\s+DISCH/]),
      compDisch: findCol(headers, [/COMP\s+DISCH/])
    };
    console.log(`  map ${sheetName} => no:${idx.no} mv:${idx.mvProjectName} qtyPlan:${idx.qtyPlan} qtyCob:${idx.qtyCob} status:${idx.shipmentStatus} blDate:${idx.blDate} sp:${idx.sp} usd:${idx.marketPriceUsd} kurs:${idx.kurs} base:${idx.basePriceIdr} adj:${idx.priceAfterAdjustment}`);

    const startRow = headerRow + headerDepth;
    let insertedThisSheet = 0;
    const carry = {
      mvProjectName: null,
      laycan: null,
      origin: null,
      shipmentFlow: null,
      jettyLoadingPort: null,
      exportDmo: null
    };

    for (let r = startRow; r < rows.length; r += 1) {
      const row = rows[r] || [];
      const line = row.map((v) => (v == null ? "" : String(v))).join(" | ");
      if (!isChildDataRow(line)) continue;

      const mvRaw = cleanStr(row[idx.mvProjectName]);
      const laycanRaw = cleanStr(row[idx.laycan]);
      const originRaw = cleanStr(row[idx.origin]);
      const flowRaw = cleanStr(row[idx.shipmentFlow]);
      const jettyRaw = cleanStr(row[idx.jettyLoadingPort]);
      const exportDmoRaw = cleanStr(row[idx.exportDmo]);

      if (mvRaw) carry.mvProjectName = mvRaw;
      if (laycanRaw) carry.laycan = laycanRaw;
      if (originRaw) carry.origin = originRaw;
      if (flowRaw) carry.shipmentFlow = flowRaw;
      if (jettyRaw) carry.jettyLoadingPort = jettyRaw;
      if (exportDmoRaw) carry.exportDmo = exportDmoRaw;

      const mvProjectName = mvRaw || carry.mvProjectName;
      const nomination = cleanStr(row[idx.nomination]);
      const no = toInt(row[idx.no]);
      const sourceRaw = cleanStr(row[idx.source]);
      const iupRaw = cleanStr(row[idx.iupOp]);
      const shipmentStatusRaw = cleanStr(row[idx.shipmentStatus]);
      if (
        isHeaderToken(mvProjectName) ||
        isHeaderToken(nomination) ||
        isHeaderToken(sourceRaw) ||
        isHeaderToken(shipmentStatusRaw)
      ) continue;
      if (!mvProjectName && !nomination && !no) continue;
      if (
        !no &&
        !hasRowDetailSignal([nomination, sourceRaw, iupRaw, jettyRaw, shipmentStatusRaw])
      ) continue;

      const vesselHint = normalizeVesselName(mvProjectName || nomination);
      const projectHint = extractProjectHint(mvProjectName);

      let mother = null;
      if (year && vesselHint) {
        const keys = [...motherIndex.keys()];
        const vesselNorm = normalizeText(vesselHint);
        mother = keys
          .map((k) => motherIndex.get(k))
          .find((m) => m.year === year && m.vesselNorm && (m.vesselNorm.includes(vesselNorm) || vesselNorm.includes(m.vesselNorm)));
      }
      if (!mother && year && projectHint) {
        const projectNorm = normalizeText(projectHint);
        const keys = [...motherIndex.keys()];
        mother = keys
          .map((k) => motherIndex.get(k))
          .find((m) => m.year === year && m.projectNorm && (m.projectNorm.includes(projectNorm) || projectNorm.includes(m.projectNorm)));
      }

      const marketPriceUsdRaw = toFloat(row[idx.marketPriceUsd]);
      const marketPriceUsd = asPlausibleUsdPerMt(marketPriceUsdRaw);
      const marketPriceIdr = toFloat(row[idx.marketPriceIdr]);
      const kurs = toFloat(row[idx.kurs]);
      const kursValid = kurs && kurs >= 1000 && kurs <= 50000 ? kurs : null;
      const basePriceIdr = toFloat(row[idx.basePriceIdr]);
      const priceAfterAdjustmentIdr = toFloat(row[idx.priceAfterAdjustment]);
      const priceComparisonIdr = toFloat(row[idx.priceComparison]);
      const spRaw = toFloat(row[idx.sp]);
      const spPlausible = spRaw && spRaw > 0 && spRaw < 500 ? spRaw : null;
      const convertedMarketUsd = (!marketPriceUsd && marketPriceIdr && kursValid)
        ? asPlausibleUsdPerMt(Number((marketPriceIdr / kursValid).toFixed(4)))
        : null;
      const priceAfterAdjUsd = (priceAfterAdjustmentIdr && kursValid)
        ? asPlausibleUsdPerMt(Number((priceAfterAdjustmentIdr / kursValid).toFixed(4)))
        : null;
      const basePriceUsd = (basePriceIdr && kursValid)
        ? asPlausibleUsdPerMt(Number((basePriceIdr / kursValid).toFixed(4)))
        : null;
      // Prefer direct USD market price; converted IDR only as fallback.
      const revenuePriceUsd = spPlausible || marketPriceUsd || convertedMarketUsd || priceAfterAdjUsd || null;
      const marginMtUsd = (priceComparisonIdr && kursValid)
        ? asPlausibleMarginUsd(Number((priceComparisonIdr / kursValid).toFixed(4)))
        : (revenuePriceUsd && basePriceUsd ? Number((revenuePriceUsd - basePriceUsd).toFixed(4)) : null);

      const qtyPlan = toFloat(row[idx.qtyPlan]);
      const qtyCob = toFloat(row[idx.qtyCob]);
      const quantityLoaded = pickFirstNumber(row, [idx.qtyCob, idx.qtyPlan]);

      const shipment = await withDbRetry(() => prisma.shipmentDetail.create({
        data: {
          no,
          exportDmo: exportDmoRaw || carry.exportDmo,
          status: statusToInternal(cleanStr(row[idx.status]), cleanStr(row[idx.shipmentStatus])),
          origin: originRaw || carry.origin || mother?.area || null,
          mvProjectName,
          source: sourceRaw,
          iupOp: iupRaw,
          shipmentFlow: flowRaw || carry.shipmentFlow || mother?.flow || null,
          jettyLoadingPort: jettyRaw || carry.jettyLoadingPort || mother?.pol || null,
          laycan: laycanRaw || carry.laycan || mother?.laycan || null,
          nomination,
          qtyPlan,
          qtyCob,
          remarks: cleanStr(row[idx.remarks]),
          shipmentStatus: cleanStr(row[idx.shipmentStatus]),
          issueNotes: cleanStr(row[idx.issue]),
          blDate: parseDate(row[idx.blDate], year || undefined),
          surveyorLhv: cleanStr(row[idx.surveyorLhv]),
          completelyLoaded: parseDate(row[idx.completelyLoaded], year || undefined),
          lhvTerbit: parseDate(row[idx.lhvTerbit], year || undefined),
          sp: spPlausible,
          deadfreight: toFloat(row[idx.deadfreight]),
          jarak: toFloat(row[idx.jarak]),
          hargaActualFobMv: marketPriceUsd || convertedMarketUsd || priceAfterAdjUsd || null,
          hargaActualFob: basePriceUsd || null,
          shippingTerm: cleanStr(row[idx.shippingTerm]) || mother?.shippingTerm || null,
          noSpal: cleanStr(row[idx.noSpal]),
          noSi: cleanStr(row[idx.noSi]),
          sentToSupplier: cleanStr(row[idx.sentToSupplier]),
          sentToBargeOwner: cleanStr(row[idx.sentToBargeOwner]),
          coaDate: parseDate(row[idx.coaDate], year || undefined),
          resultGar: toFloat(row[idx.resultGar]),
          buyer: mother?.buyer || null,
          vesselName: mother?.vessel || vesselHint || mvProjectName || null,
          bargeName: nomination,
          loadingPort: cleanStr(row[idx.jettyLoadingPort]) || mother?.pol || null,
          quantityLoaded,
          salesPrice: revenuePriceUsd,
          marginMt: marginMtUsd,
          product: mother?.product || null,
          type: typeFromExportDmo(cleanStr(row[idx.exportDmo])),
          year: year || new Date().getFullYear()
        }
      }), "shipmentDetail.create(child)");

      childInserted += 1;
      insertedThisSheet += 1;

      const milestones = milestoneRowsFromChild(row, idx, year || new Date().getFullYear(), sheetName);
      if (milestones.length > 0) {
        const timelineRows = milestones.map((m) => ({
          shipmentId: shipment.id,
          title: m.title,
          date: m.date,
          description: m.description
        }));
        const created = await withDbRetry(() => prisma.timelineMilestone.createMany({ data: timelineRows }), "timelineMilestone.createMany(child)");
        milestoneInserted += created.count;
      }
    }

    console.log(`- ${sheetName}: inserted ${insertedThisSheet} child rows`);
  }

  const counts = {
    mothers: await withDbRetry(() => prisma.dailyDelivery.count({ where: { isDeleted: false } }), "dailyDelivery.count"),
    children: await withDbRetry(() => prisma.shipmentDetail.count({ where: { isDeleted: false } }), "shipmentDetail.count"),
    milestones: await withDbRetry(() => prisma.timelineMilestone.count(), "timelineMilestone.count")
  };

  console.log("-----------------------------------------------");
  console.log("Migration finished.");
  console.log(`Mothers    : ${counts.mothers}`);
  console.log(`Children   : ${counts.children}`);
  console.log(`Milestones : ${counts.milestones}`);
}

migrate()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
