import type { AutofixRule } from "../core/autofix-engine";
import bundledCsv from "../../data/text-replacements.csv?raw";
import { parseSheetReplacementRows, rowsToAutofixRules } from "./replacement-rows";

export type SheetRulesLoadStats = {
  totalCount: number;
  fromRemote: boolean;
};

const bundledSheetRows = parseSheetReplacementRows(bundledCsv);
const bundledSheetRules = rowsToAutofixRules(bundledSheetRows, "sheet-bundled");

let activeSheetRules: AutofixRule[] = bundledSheetRules;
let lastLoadStats: SheetRulesLoadStats = {
  totalCount: bundledSheetRules.length,
  fromRemote: false,
};

export function getSheetReplacementRules(): AutofixRule[] {
  return activeSheetRules;
}

export function getSheetRulesLoadStats(): SheetRulesLoadStats {
  return lastLoadStats;
}

/** @deprecated Используйте getSheetRulesLoadStats. */
export function getSheetRulesMergeStats(): {
  totalCount: number;
  remoteCount: number;
  bundledOnlyCount: number;
} {
  return {
    totalCount: lastLoadStats.totalCount,
    remoteCount: lastLoadStats.fromRemote ? lastLoadStats.totalCount : 0,
    bundledOnlyCount: lastLoadStats.fromRemote ? 0 : lastLoadStats.totalCount,
  };
}

/** Загрузить CSV словаря; пустой/битый → false, активный набор не меняется. */
export function applySheetRulesFromCsv(raw: string): boolean {
  const rows = parseSheetReplacementRows(raw.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return false;

  activeSheetRules = rowsToAutofixRules(rows, "sheet-text");
  lastLoadStats = {
    totalCount: activeSheetRules.length,
    fromRemote: true,
  };
  return true;
}

/** @deprecated Используйте applySheetRulesFromCsv. */
export function applySheetRulesFromRemoteCsv(raw: string): boolean {
  return applySheetRulesFromCsv(raw);
}

export function resetSheetRulesToBundled(): void {
  activeSheetRules = bundledSheetRules;
  lastLoadStats = {
    totalCount: bundledSheetRules.length,
    fromRemote: false,
  };
}
