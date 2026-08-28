import type { AutofixRule } from "../core/autofix-engine";
import bundledCsv from "../../data/text-replacements.csv?raw";
import { stripUtf8Bom } from "../shared/text-normalize";
import { createRemoteBackedStore } from "./remote-backed-store";
import { parseSheetReplacementRows, rowsToAutofixRules } from "./replacement-rows";

export type LexiconRulesLoadStats = {
  totalCount: number;
  fromRemote: boolean;
};

const bundledSheetRows = parseSheetReplacementRows(bundledCsv);
const bundledLexiconRules = rowsToAutofixRules(bundledSheetRows, "sheet-bundled");
const store = createRemoteBackedStore(bundledLexiconRules, (rules) => rules.length);

export function getLexiconReplacementRules(): AutofixRule[] {
  return store.get();
}

/** @deprecated Используйте getLexiconReplacementRules. */
export const getSheetReplacementRules = getLexiconReplacementRules;

export function getLexiconRulesLoadStats(): LexiconRulesLoadStats {
  const stats = store.getLoadStats();
  return { totalCount: stats.count, fromRemote: stats.fromRemote };
}

/** @deprecated Используйте getLexiconRulesLoadStats. */
export const getSheetRulesLoadStats = getLexiconRulesLoadStats;

/** Загрузить CSV словаря; пустой/битый → false, активный набор не меняется. */
export function applyLexiconReplacementsFromCsv(raw: string): boolean {
  const rows = parseSheetReplacementRows(stripUtf8Bom(raw));
  if (rows.length === 0) return false;
  return store.apply(rowsToAutofixRules(rows, "sheet-text"));
}

/** @deprecated Используйте applyLexiconReplacementsFromCsv. */
export const applySheetRulesFromCsv = applyLexiconReplacementsFromCsv;

export function resetLexiconReplacementsToBundled(): void {
  store.resetToBundled();
}

/** @deprecated Используйте resetLexiconReplacementsToBundled. */
export const resetSheetRulesToBundled = resetLexiconReplacementsToBundled;
