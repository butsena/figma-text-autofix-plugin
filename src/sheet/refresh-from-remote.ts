import { TEAM_SPREADSHEET_ID } from "../config/text-replacements-remote-url";
import { invalidateAutofixRulesCache } from "../rules/autofix-rules";
import {
  extractSpreadsheetId,
  fetchUrlWithCacheBust,
  formatFetchError,
  looksLikeHtmlNotCsv,
  previewResponseText,
  resolveSheetFetchUrl,
} from "./google-sheets-url";
import {
  applySheetRulesFromRemoteCsv,
  getSheetRulesMergeStats,
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
  const stats = getSheetRulesMergeStats();
  return {
    ruleCount: stats.totalCount,
    remoteRuleCount: stats.remoteCount,
    bundledOnlyRuleCount: stats.bundledOnlyCount,
  };
}

function applyDownloadedCsv(text: string, fetchUrl: string): RefreshSheetRulesResult {
  if (looksLikeHtmlNotCsv(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...sheetLoadCounts(),
      errorMessage:
        "Ответ не CSV (часто страница входа Google). Доступ: «все, у кого есть ссылка» → Читатель.",
      fetchUrl,
    };
  }
  if (!applySheetRulesFromRemoteCsv(text)) {
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

/**
 * Подтянуть CSV таблицы замен. Для Google Sheets `fetchCsv` — через JSONP в UI (обход CORS).
 */
export async function refreshTextReplacementsFromRemote(
  csvUrl: string,
  fetchCsv: (fetchUrl: string) => Promise<string>,
): Promise<RefreshSheetRulesResult> {
  const fallback = csvUrl.trim();
  const fetchUrl = resolveSheetFetchUrl(csvUrl, fallback);

  if (!fallback) {
    resetSheetRulesToBundled();
    invalidateAutofixRulesCache();
    return { ok: true, fromRemote: false, ...sheetLoadCounts() };
  }

  try {
    console.log("[text-autofix] load CSV:", fetchUrl);
    const text = await fetchCsv(fetchUrl);
    console.log("[text-autofix] CSV bytes:", text.length);
    const result = applyDownloadedCsv(text, fetchUrl);
    if (!result.ok) {
      resetSheetRulesToBundled();
      invalidateAutofixRulesCache();
    }
    const loadedId = extractSpreadsheetId(fetchUrl);
    if (result.ok && loadedId && loadedId !== TEAM_SPREADSHEET_ID) {
      console.warn("[text-autofix] loaded sheet id differs from TEAM_SPREADSHEET_ID");
    }
    return result;
  } catch (e) {
    console.warn("[text-autofix] sheet load failed:", e);
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

/** Прямой fetch (для не-Google URL). В Figma для Sheets не работает из‑за CORS. */
export async function fetchCsvViaHttp(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrlWithCacheBust(fetchUrl), { method: "GET", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Начало ответа: ${previewResponseText(text)}`);
  }
  return text;
}
