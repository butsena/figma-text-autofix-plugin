import type { AutofixRule } from "../core/autofix-engine";
import { cyrillicWholeWordPattern, escapeRegex } from "../rules/regex";
import { headerColIndex, isEnabledCell, parseCsvRows } from "./csv";
import { resolveLexiconMessage } from "./lexicon-messages";

export type SheetRulesMergeStats = {
  totalCount: number;
  remoteCount: number;
  /** Правила только из локального CSV (варианты не перекрыты таблицей). */
  bundledOnlyCount: number;
};

export type SheetReplacementRow = {
  variants: string[];
  replace: string;
  message: string;
  category: string;
  priority: number;
};

function normVariantKey(variant: string): string {
  return variant.trim().toLowerCase();
}

function splitVariantList(cell: string): string[] {
  return cell
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildWholeWordAlternationRule(
  id: string,
  variants: string[],
  replace: string,
  message: string,
  category: string,
  priority: number,
): AutofixRule | null {
  const uniq = [...new Set(variants.map((v) => v.trim()).filter(Boolean))];
  if (uniq.length === 0 || !replace) return null;

  const sorted = [...uniq].sort((a, b) => b.length - a.length);
  const alt = sorted.map(escapeRegex).join("|");

  return {
    id,
    category,
    pattern: cyrillicWholeWordPattern(alt),
    replacement: (_m, prefix) => `${prefix}${replace}`,
    message,
    priority,
  };
}

export function parseSheetReplacementRows(raw: string): SheetReplacementRow[] {
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
  const iMsg = headerColIndex(header, ["пояснение", "message", "комментарий"]);
  const iPri = headerColIndex(header, ["приоритет", "priority"]);
  const iCat = headerColIndex(header, ["категория", "category"]);

  const out: SheetReplacementRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < Math.max(iVar, iRep) + 1) continue;

    const enabledCell = iEn >= 0 ? row[iEn] : "yes";
    if (!isEnabledCell(enabledCell)) continue;

    const variants = splitVariantList(row[iVar].trim());
    const replace = row[iRep].trim();
    if (variants.length === 0 || !replace) continue;

    const priority =
      iPri >= 0 && row[iPri]?.trim() !== "" ? Number.parseInt(row[iPri].trim(), 10) : 70;
    if (Number.isNaN(priority)) continue;

    const category = iCat >= 0 && row[iCat]?.trim() !== "" ? row[iCat].trim() : "sheet_text";
    const defaultMsg = resolveLexiconMessage(variants, replace);
    const message = iMsg >= 0 && row[iMsg]?.trim() !== "" ? row[iMsg].trim() : defaultMsg;

    out.push({ variants, replace, message, category, priority });
  }

  return out;
}

export function rowsToAutofixRules(rows: SheetReplacementRow[], idPrefix: string): AutofixRule[] {
  const rules: AutofixRule[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rule = buildWholeWordAlternationRule(
      `${idPrefix}-${i + 1}`,
      row.variants,
      row.replace,
      row.message,
      row.category,
      row.priority,
    );
    if (rule) rules.push(rule);
  }
  return rules;
}

/**
 * Сначала правила из таблицы; из локального CSV — только строки, чьих вариантов нет в таблице.
 */
export function mergeSheetReplacementRows(
  bundledRows: SheetReplacementRow[],
  remoteRows: SheetReplacementRow[],
): { rows: SheetReplacementRow[]; remoteCount: number; bundledOnlyCount: number } {
  const remoteVariantKeys = new Set<string>();
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

export function buildRulesFromMergedRows(
  bundledRows: SheetReplacementRow[],
  remoteRows: SheetReplacementRow[],
): { rules: AutofixRule[]; stats: SheetRulesMergeStats } {
  const { rows, remoteCount, bundledOnlyCount } = mergeSheetReplacementRows(bundledRows, remoteRows);
  const rules = rowsToAutofixRules(rows, "sheet-text");
  return {
    rules,
    stats: {
      totalCount: rules.length,
      remoteCount,
      bundledOnlyCount,
    },
  };
}
