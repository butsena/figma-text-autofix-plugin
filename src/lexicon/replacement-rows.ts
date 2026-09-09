import type { AutofixRule } from "../core/autofix-engine";
import { capitalizeLike } from "../shared/case";
import { cyrillicWholeWordPattern, escapeRegex } from "../rules/regex";
import { headerColIndex, isEnabledCell, parseCsvRows } from "./csv";
import { resolveLexiconMessage } from "./lexicon-messages";
import { affixReplacement, affixStemPattern } from "./replacement-affix";

/** Тип правила в курируемом словаре замен. */
export type ReplacementKind = "exact" | "spell" | "join" | "lemma" | "phrase" | "special";

export type ReplacementFormPair = {
  variants: string[];
  replace: string;
};

export type ReplacementRow = {
  kind: ReplacementKind;
  /** Исходные варианты (основа для spell/join; базовые формы для остальных). */
  variants: string[];
  replace: string;
  /** Доп. пары словоформ для lemma/phrase. */
  forms: ReplacementFormPair[];
  message: string;
  category: string;
  priority: number;
};

const KIND_ALIASES: Record<string, ReplacementKind> = {
  exact: "exact",
  spell: "spell",
  join: "join",
  lemma: "lemma",
  phrase: "phrase",
  special: "special",
  // русские синонимы
  точно: "exact",
  орфография: "spell",
  слитно: "join",
  лемма: "lemma",
  фраза: "phrase",
  особое: "special",
};

function splitVariantList(cell: string): string[] {
  return cell
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `приобрёл|приобрел=купил; приобрела=купила` */
export function parseFormsCell(cell: string): ReplacementFormPair[] {
  const raw = cell.trim();
  if (!raw) return [];

  const out: ReplacementFormPair[] = [];
  for (const part of raw.split(";")) {
    const piece = part.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    const left = piece.slice(0, eq).trim();
    const right = piece.slice(eq + 1).trim();
    if (!left || !right) continue;
    const variants = left
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (variants.length === 0) continue;
    out.push({ variants, replace: right });
  }
  return out;
}

function parseKind(raw: string): ReplacementKind | null {
  const key = raw.trim().toLowerCase();
  return KIND_ALIASES[key] ?? null;
}

function canonicalReplace(replace: string): string {
  return replace === "₽" ? "₽" : replace.toLowerCase();
}

function allFormPairs(row: ReplacementRow): ReplacementFormPair[] {
  return [{ variants: row.variants, replace: row.replace }, ...row.forms];
}

function buildLookupMap(pairs: ReplacementFormPair[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of pairs) {
    const to = canonicalReplace(pair.replace);
    for (const v of pair.variants) {
      const key = v.trim().toLowerCase();
      if (key) map.set(key, to);
    }
  }
  return map;
}

function buildCaseAwareMapRule(
  id: string,
  pairs: ReplacementFormPair[],
  message: string,
  category: string,
  priority: number,
): AutofixRule | null {
  const map = buildLookupMap(pairs);
  if (map.size === 0) return null;

  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const alt = keys.map(escapeRegex).join("|");

  return {
    id,
    category,
    pattern: cyrillicWholeWordPattern(alt, "giu"),
    replacement: (_m, prefix, word) => {
      const to = map.get(word.toLowerCase());
      if (!to) return `${prefix}${word}`;
      if (to === "₽") return `${prefix}₽`;
      return `${prefix}${capitalizeLike(word, to)}`;
    },
    message,
    priority,
  };
}

function buildAffixRule(
  id: string,
  stems: string[],
  replaceStem: string,
  message: string,
  category: string,
  priority: number,
): AutofixRule | null {
  const pattern = affixStemPattern(stems);
  if (!pattern || !replaceStem) return null;

  return {
    id,
    category,
    pattern,
    replacement: affixReplacement(replaceStem, stems),
    message,
    priority,
  };
}

function rowToRule(row: ReplacementRow, id: string): AutofixRule | null {
  switch (row.kind) {
    case "spell":
    case "join":
      return buildAffixRule(id, row.variants, row.replace, row.message, row.category, row.priority);
    case "lemma":
    case "phrase":
      return buildCaseAwareMapRule(id, allFormPairs(row), row.message, row.category, row.priority);
    case "exact":
    case "special":
    default:
      return buildCaseAwareMapRule(
        id,
        [{ variants: row.variants, replace: row.replace }],
        row.message,
        row.category,
        row.priority,
      );
  }
}

function ruleFingerprint(rule: AutofixRule): string {
  return `${rule.pattern.source}::${rule.message}::${rule.priority}`;
}

export function parseReplacementRows(raw: string): ReplacementRow[] {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return [];

  const header = rows[0].map((c) => c.trim());
  const iKind = headerColIndex(header, ["тип", "kind", "type"]);
  // «исходные варианты» / «верный текст» — имена старого двуколоночного CSV.
  // Их нельзя убирать: опубликованный плагин до typed-словаря не знает «найти»/«заменить»
  // и иначе читает col0=тип, col1=найти (тогда «он-лайн» не находится).
  let iVar = headerColIndex(header, ["исходные варианты", "найти", "variants", "find", "from"]);
  let iRep = headerColIndex(header, ["верный текст", "заменить", "replacement", "replace", "to"]);

  if (iVar < 0 && iRep < 0 && header.length >= 2) {
    // Старый формат без заголовков-алиасов: col0/col1, либо заголовок «исходные варианты,верный текст»
    if (iKind < 0) {
      iVar = 0;
      iRep = 1;
    }
  }
  if (iVar < 0 || iRep < 0) return [];

  const iForms = headerColIndex(header, ["формы", "forms"]);
  const iEn = headerColIndex(header, ["включено", "enabled", "активно"]);
  const iMsg = headerColIndex(header, ["пояснение", "message", "комментарий"]);
  const iPri = headerColIndex(header, ["приоритет", "priority"]);
  const iCat = headerColIndex(header, ["категория", "category"]);

  const out: ReplacementRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < Math.max(iVar, iRep) + 1) continue;

    const enabledCell = iEn >= 0 ? row[iEn] : "yes";
    if (!isEnabledCell(enabledCell)) continue;

    const variants = splitVariantList(row[iVar].trim());
    const replace = row[iRep].trim();
    if (variants.length === 0 || !replace) continue;

    let kind: ReplacementKind = "exact";
    if (iKind >= 0) {
      const parsed = parseKind(row[iKind] ?? "");
      if (!parsed) continue;
      kind = parsed;
    }

    const priority =
      iPri >= 0 && row[iPri]?.trim() !== "" ? Number.parseInt(row[iPri].trim(), 10) : 70;
    if (Number.isNaN(priority)) continue;

    const category = iCat >= 0 && row[iCat]?.trim() !== "" ? row[iCat].trim() : "sheet_text";
    const forms = iForms >= 0 ? parseFormsCell(row[iForms] ?? "") : [];
    const defaultMsg = resolveLexiconMessage(variants, replace);
    const message = iMsg >= 0 && row[iMsg]?.trim() !== "" ? row[iMsg].trim() : defaultMsg;

    out.push({ kind, variants, replace, forms, message, category, priority });
  }

  return out;
}

export function rowsToAutofixRules(rows: ReplacementRow[], idPrefix: string): AutofixRule[] {
  const rules: AutofixRule[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rule = rowToRule(rows[i], `${idPrefix}-${i + 1}`);
    if (!rule) continue;
    const fp = ruleFingerprint(rule);
    if (seen.has(fp)) continue;
    seen.add(fp);
    rules.push(rule);
  }
  return rules;
}
