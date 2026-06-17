/**
 * Шаг 1 миграции: синхронизировать Google Таблицу → data/text-replacements.csv.
 * Логика merge совпадает с mergeSheetReplacementRows в replacement-rows.ts.
 *
 * Usage:
 *   node scripts/sync-text-replacements-from-google.mjs
 *   node scripts/sync-text-replacements-from-google.mjs --dry-run
 *   node scripts/sync-text-replacements-from-google.mjs --input data/.google-sheet-snapshot.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundledPath = path.join(root, "data/text-replacements.csv");
const defaultRemoteUrl =
  "https://docs.google.com/spreadsheets/d/1MHRXUqdkuUAJTerU4fEWtvhUH8Fbi5SkVjSo_5SSH90/gviz/tq?tqx=out:csv&gid=0";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputIdx = args.indexOf("--input");
const remotePath = inputIdx >= 0 ? path.resolve(root, args[inputIdx + 1]) : null;

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsvRows(raw) {
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function normHeader(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function headerColIndex(header, aliases) {
  const h = header.map(normHeader);
  for (const a of aliases) {
    const i = h.indexOf(normHeader(a));
    if (i >= 0) return i;
  }
  return -1;
}

function isEnabledCell(cell) {
  const v = cell.trim().toLowerCase();
  return v === "yes" || v === "true" || v === "1" || v === "да";
}

function splitVariantList(cell) {
  return cell
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSheetReplacementRows(raw) {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return [];

  const header = rows[0].map((c) => c.trim());
  let iVar = headerColIndex(header, ["исходные варианты", "variants", "find", "from"]);
  let iRep = headerColIndex(header, ["верный текст", "replacement", "replace", "to"]);
  if (iVar < 0 && iRep < 0 && header.length >= 2) {
    iVar = 0;
    iRep = 1;
  } else if (iVar < 0 || iRep < 0) {
    return [];
  }

  const iEn = headerColIndex(header, ["включено", "enabled", "активно"]);
  const out = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < Math.max(iVar, iRep) + 1) continue;

    const enabledCell = iEn >= 0 ? row[iEn] : "yes";
    if (!isEnabledCell(enabledCell)) continue;

    const variants = splitVariantList(row[iVar].trim());
    const replace = row[iRep].trim();
    if (variants.length === 0 || !replace) continue;

    out.push({ variants, replace });
  }

  return out;
}

function normVariantKey(variant) {
  return variant.trim().toLowerCase();
}

function mergeSheetReplacementRows(bundledRows, remoteRows) {
  const remoteVariantKeys = new Set();
  for (const row of remoteRows) {
    for (const v of row.variants) {
      remoteVariantKeys.add(normVariantKey(v));
    }
  }

  const bundledOnly = bundledRows.filter((row) =>
    row.variants.every((v) => !remoteVariantKeys.has(normVariantKey(v))),
  );

  return {
    rows: [...remoteRows, ...bundledOnly],
    remoteCount: remoteRows.length,
    bundledOnlyCount: bundledOnly.length,
  };
}

function escapeCsvCell(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatVariantsCell(variants) {
  const cell = variants.join(", ");
  return escapeCsvCell(cell);
}

function rowsToCsv(rows) {
  const lines = ["исходные варианты,верный текст"];
  for (const row of rows) {
    lines.push(`${formatVariantsCell(row.variants)},${escapeCsvCell(row.replace)}`);
  }
  return `${lines.join("\n")}\n`;
}

async function loadRemoteCsv() {
  if (remotePath) {
    return fs.readFileSync(remotePath, "utf8");
  }
  const res = await fetch(defaultRemoteUrl, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  if (text.trimStart().startsWith("<")) {
    throw new Error("Ответ не CSV (возможно страница входа Google).");
  }
  return text;
}

const bundledRaw = fs.readFileSync(bundledPath, "utf8");
const remoteRaw = await loadRemoteCsv();

const bundledRows = parseSheetReplacementRows(bundledRaw);
const remoteRows = parseSheetReplacementRows(remoteRaw);

if (remoteRows.length === 0) {
  console.error("[sync-text-replacements] remote CSV пуст или не распознан");
  process.exit(1);
}

const { rows, remoteCount, bundledOnlyCount } = mergeSheetReplacementRows(bundledRows, remoteRows);
const mergedCsv = rowsToCsv(rows);

console.log("[sync-text-replacements] bundled rows:", bundledRows.length);
console.log("[sync-text-replacements] remote rows:", remoteCount);
console.log("[sync-text-replacements] bundled-only kept:", bundledOnlyCount);
console.log("[sync-text-replacements] merged total:", rows.length);

if (dryRun) {
  console.log("[sync-text-replacements] dry-run: файл не записан");
  process.exit(0);
}

fs.writeFileSync(bundledPath, mergedCsv, "utf8");
console.log("[sync-text-replacements] wrote", path.relative(root, bundledPath));
