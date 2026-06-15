import type { AutofixRule } from "../core/autofix-engine";
import bundledCsv from "../../data/text-replacements.csv?raw";
import {
  buildRulesFromMergedRows,
  parseSheetReplacementRows,
  rowsToAutofixRules,
  type SheetRulesMergeStats,
} from "./replacement-rows";

const bundledSheetRows = parseSheetReplacementRows(bundledCsv);
const bundledSheetRules = rowsToAutofixRules(bundledSheetRows, "sheet-bundled");

let activeSheetRules: AutofixRule[] = bundledSheetRules;
let lastMergeStats: SheetRulesMergeStats = {
  totalCount: bundledSheetRules.length,
  remoteCount: 0,
  bundledOnlyCount: bundledSheetRows.length,
};

export function getSheetReplacementRules(): AutofixRule[] {
  return activeSheetRules;
}

export function getSheetRulesMergeStats(): SheetRulesMergeStats {
  return lastMergeStats;
}

/**
 * Загрузить CSV таблицы и объединить с локальным бандлом.
 * Пустой/битый remote → false, активный набор не меняется.
 */
export function applySheetRulesFromRemoteCsv(raw: string): boolean {
  const remoteRows = parseSheetReplacementRows(raw.replace(/^\uFEFF/, ""));
  if (remoteRows.length === 0) return false;

  const { rules, stats } = buildRulesFromMergedRows(bundledSheetRows, remoteRows);
  activeSheetRules = rules;
  lastMergeStats = stats;
  return true;
}

export function resetSheetRulesToBundled(): void {
  activeSheetRules = bundledSheetRules;
  lastMergeStats = {
    totalCount: bundledSheetRules.length,
    remoteCount: 0,
    bundledOnlyCount: bundledSheetRows.length,
  };
}
