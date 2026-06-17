import { invalidateAutofixRulesCache } from "../rules/autofix-rules";
import {
  fetchUrlWithCacheBust,
  formatFetchError,
  looksLikeHtmlNotCsv,
  previewResponseText,
} from "./google-sheets-url";
import {
  applySheetRulesFromCsv,
  getSheetRulesLoadStats,
  resetSheetRulesToBundled,
} from "./replacement-rules-store";

export type RefreshSheetRulesResult = {
  ok: boolean;
  ruleCount: number;
  fromRemote: boolean;
  remoteRuleCount?: number;
  bundledOnlyRuleCount?: number;
  errorMessage?: string;
  fetchUrl?: string;
};

function sheetLoadCounts(): Pick<
  RefreshSheetRulesResult,
  "ruleCount" | "remoteRuleCount" | "bundledOnlyRuleCount"
> {
  const stats = getSheetRulesLoadStats();
  return {
    ruleCount: stats.totalCount,
    remoteRuleCount: stats.fromRemote ? stats.totalCount : 0,
    bundledOnlyRuleCount: stats.fromRemote ? 0 : stats.totalCount,
  };
}

function applyDownloadedCsv(text: string, fetchUrl: string): RefreshSheetRulesResult {
  if (looksLikeHtmlNotCsv(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...sheetLoadCounts(),
      errorMessage: "Ответ не CSV (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applySheetRulesFromCsv(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...sheetLoadCounts(),
      errorMessage: `CSV получен, но правила не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  invalidateAutofixRulesCache();
  return {
    ok: true,
    fromRemote: true,
    ...sheetLoadCounts(),
    fetchUrl,
  };
}

/** Подтянуть CSV словаря замен по URL; при ошибке — fallback на bundled. */
export async function refreshTextReplacementsFromRemote(
  csvUrl: string,
  fetchCsv: (fetchUrl: string) => Promise<string>,
): Promise<RefreshSheetRulesResult> {
  const fetchUrl = csvUrl.trim();

  if (!fetchUrl) {
    resetSheetRulesToBundled();
    invalidateAutofixRulesCache();
    return { ok: true, fromRemote: false, ...sheetLoadCounts() };
  }

  try {
    console.log("[text-autofix] load CSV:", fetchUrl);
    const text = await fetchCsv(fetchUrlWithCacheBust(fetchUrl));
    console.log("[text-autofix] CSV bytes:", text.length);
    const result = applyDownloadedCsv(text, fetchUrl);
    if (!result.ok) {
      resetSheetRulesToBundled();
      invalidateAutofixRulesCache();
    }
    return result;
  } catch (e) {
    console.warn("[text-autofix] CSV load failed:", e);
    resetSheetRulesToBundled();
    invalidateAutofixRulesCache();
    return {
      ok: false,
      fromRemote: false,
      ...sheetLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    };
  }
}

export async function fetchCsvViaHttp(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { method: "GET", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Начало ответа: ${previewResponseText(text)}`);
  }
  return text;
}
