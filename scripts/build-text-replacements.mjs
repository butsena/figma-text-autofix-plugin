/**
 * Проверка и статистика курируемого словаря замен.
 * Запуск: node scripts/build-text-replacements.mjs
 *
 * Офлайн-расширение парадигм: если у lemma/phrase пустая колонка «формы»,
 * подтягивает пары из data/replacement-paradigms/<найти>-<заменить>.txt
 * (строки `исход=цель` или `исход1|исход2=цель`) и печатает готовый CSV в stdout
 * при флаге --expand.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "data/text-replacements.csv");
const paradigmsDir = join(root, "data/replacement-paradigms");

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

function loadParadigm(find, replace) {
  if (!existsSync(paradigmsDir)) return "";
  const safe = (s) => s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  const name = `${safe(find)}-${safe(replace)}.txt`;
  const path = join(paradigmsDir, name);
  if (!existsSync(path)) return "";
  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="));
  return lines.join("; ");
}

function main() {
  const expand = process.argv.includes("--expand");
  const write = process.argv.includes("--write");
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) {
    console.error("CSV пуст");
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  const iKind = header.findIndex((h) => ["тип", "kind", "type"].includes(h.trim().toLowerCase()));
  const iFind = header.findIndex((h) =>
    ["найти", "исходные варианты", "variants", "find", "from"].includes(h.trim().toLowerCase()),
  );
  const iRep = header.findIndex((h) =>
    ["заменить", "верный текст", "replacement", "replace", "to"].includes(h.trim().toLowerCase()),
  );
  const iForms = header.findIndex((h) => ["формы", "forms"].includes(h.trim().toLowerCase()));

  if (iKind < 0 || iFind < 0 || iRep < 0) {
    console.error("Ожидается новый формат: тип,найти,заменить[,формы]");
    process.exit(1);
  }

  const counts = {};
  let formPairs = 0;
  const outRows = [header];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const kind = (cols[iKind] || "").trim().toLowerCase();
    const find = (cols[iFind] || "").trim();
    const replace = (cols[iRep] || "").trim();
    let forms = iForms >= 0 ? (cols[iForms] || "").trim() : "";

    counts[kind] = (counts[kind] || 0) + 1;

    if (expand && !forms && (kind === "lemma" || kind === "phrase")) {
      forms = loadParadigm(find, replace);
      if (iForms >= 0) cols[iForms] = forms;
      else {
        // extend header on the fly only for stdout expand without forms col — skip
      }
    }

    if (forms) {
      formPairs += forms.split(";").filter((p) => p.trim()).length;
    }
    outRows.push(cols);
  }

  console.log("text-replacements.csv");
  console.log(`  правил: ${outRows.length - 1}`);
  console.log(`  по типам: ${JSON.stringify(counts)}`);
  console.log(`  пар в колонке формы: ${formPairs}`);
  if (existsSync(paradigmsDir)) {
    const files = readdirSync(paradigmsDir).filter((f) => f.endsWith(".txt"));
    console.log(`  paradigm-файлов: ${files.length}`);
  }

  if (expand) {
    const escape = (cell) => {
      if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
      return cell;
    };
    const text = outRows.map((r) => r.map(escape).join(",")).join("\n") + "\n";
    if (write) {
      writeFileSync(csvPath, text, "utf8");
      console.log("  записано с подставленными парадигмами");
    } else {
      process.stdout.write(text);
    }
  }
}

main();
