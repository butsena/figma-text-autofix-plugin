import { invalidateAutofixRulesCache } from "../rules/autofix-rules";
import {
  fetchUrlWithCacheBust,
  formatFetchError,
  looksLikeHtmlResponse,
  previewResponseText,
} from "./csv-fetch";
import {
  applyLexiconReplacementsFromCsv,
  getLexiconRulesLoadStats,
  resetLexiconReplacementsToBundled,
} from "./replacement-rules-store";
import {
  applyBoundaryExceptionsFromRaw,
  getBoundaryExceptionsLoadStats,
  resetBoundaryExceptionsToBundled,
} from "./boundary-exceptions-store";
import {
  applyAmbiguousFormChoicesFromRaw,
  getAmbiguousFormChoicesLoadStats,
  resetAmbiguousFormChoicesToBundled,
} from "../rules/choice/ambiguous-form-choices-store";

export type RefreshLexiconReplacementsResult = {
  ok: boolean;
  ruleCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

/** @deprecated Используйте RefreshLexiconReplacementsResult. */
export type RefreshSheetRulesResult = RefreshLexiconReplacementsResult;

export type RefreshBoundaryExceptionsResult = {
  ok: boolean;
  phraseCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshAmbiguousFormChoicesResult = {
  ok: boolean;
  choiceCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

type RemoteRefreshHandlers<TResult extends { ok: boolean; fromRemote: boolean }> = {
  resetBundled: () => void;
  buildEmptyUrlResult: () => TResult;
  processDownload: (text: string, fetchUrl: string) => TResult;
  buildNetworkErrorResult: (fetchUrl: string, error: unknown) => TResult;
};

async function runRemoteRefresh<TResult extends { ok: boolean; fromRemote: boolean }>(
  url: string,
  logLabel: string,
  fetchText: (fetchUrl: string) => Promise<string>,
  handlers: RemoteRefreshHandlers<TResult>,
): Promise<TResult> {
  const fetchUrl = url.trim();

  if (!fetchUrl) {
    handlers.resetBundled();
    invalidateAutofixRulesCache();
    return handlers.buildEmptyUrlResult();
  }

  try {
    console.log(`[text-autofix] load ${logLabel}:`, fetchUrl);
    const text = await fetchText(fetchUrlWithCacheBust(fetchUrl));
    console.log(`[text-autofix] ${logLabel} bytes:`, text.length);
    const result = handlers.processDownload(text, fetchUrl);
    if (!result.ok) {
      handlers.resetBundled();
      invalidateAutofixRulesCache();
    }
    return result;
  } catch (e) {
    console.warn(`[text-autofix] ${logLabel} load failed:`, e);
    handlers.resetBundled();
    invalidateAutofixRulesCache();
    return handlers.buildNetworkErrorResult(fetchUrl, e);
  }
}

function replacementLoadCounts(): Pick<RefreshLexiconReplacementsResult, "ruleCount"> {
  return { ruleCount: getLexiconRulesLoadStats().totalCount };
}

function boundaryLoadCounts(): Pick<RefreshBoundaryExceptionsResult, "phraseCount"> {
  return { phraseCount: getBoundaryExceptionsLoadStats().count };
}

function ambiguousFormChoicesLoadCounts(): Pick<RefreshAmbiguousFormChoicesResult, "choiceCount"> {
  return { choiceCount: getAmbiguousFormChoicesLoadStats().count };
}

function applyDownloadedCsv(text: string, fetchUrl: string): RefreshLexiconReplacementsResult {
  if (looksLikeHtmlResponse(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...replacementLoadCounts(),
      errorMessage: "Ответ не CSV (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applyLexiconReplacementsFromCsv(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...replacementLoadCounts(),
      errorMessage: `CSV получен, но правила не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  invalidateAutofixRulesCache();
  return {
    ok: true,
    fromRemote: true,
    ...replacementLoadCounts(),
    fetchUrl,
  };
}

function applyDownloadedBoundaryExceptions(
  text: string,
  fetchUrl: string,
): RefreshBoundaryExceptionsResult {
  if (looksLikeHtmlResponse(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...boundaryLoadCounts(),
      errorMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applyBoundaryExceptionsFromRaw(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...boundaryLoadCounts(),
      errorMessage: `Файл получен, но фразы не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  invalidateAutofixRulesCache();
  return {
    ok: true,
    fromRemote: true,
    ...boundaryLoadCounts(),
    fetchUrl,
  };
}

function applyDownloadedAmbiguousFormChoices(
  text: string,
  fetchUrl: string,
): RefreshAmbiguousFormChoicesResult {
  if (looksLikeHtmlResponse(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...ambiguousFormChoicesLoadCounts(),
      errorMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applyAmbiguousFormChoicesFromRaw(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...ambiguousFormChoicesLoadCounts(),
      errorMessage: `Файл получен, но пары не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  invalidateAutofixRulesCache();
  return {
    ok: true,
    fromRemote: true,
    ...ambiguousFormChoicesLoadCounts(),
    fetchUrl,
  };
}

/** Подтянуть CSV словаря замен по URL; при ошибке — fallback на bundled. */
export async function refreshTextReplacementsFromRemote(
  csvUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshLexiconReplacementsResult> {
  return runRemoteRefresh(csvUrl, "CSV", fetchText, {
    resetBundled: resetLexiconReplacementsToBundled,
    buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, ...replacementLoadCounts() }),
    processDownload: applyDownloadedCsv,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ...replacementLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}

/** Подтянуть список исключений по URL; при ошибке — fallback на bundled. */
export async function refreshBoundaryExceptionsFromRemote(
  txtUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshBoundaryExceptionsResult> {
  return runRemoteRefresh(txtUrl, "boundary exceptions", fetchText, {
    resetBundled: resetBoundaryExceptionsToBundled,
    buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, ...boundaryLoadCounts() }),
    processDownload: applyDownloadedBoundaryExceptions,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ...boundaryLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}

/** Подтянуть пары выборочных форм по URL; при ошибке — fallback на bundled. */
export async function refreshAmbiguousFormChoicesFromRemote(
  txtUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshAmbiguousFormChoicesResult> {
  return runRemoteRefresh(txtUrl, "ambiguous form choices", fetchText, {
    resetBundled: resetAmbiguousFormChoicesToBundled,
    buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, ...ambiguousFormChoicesLoadCounts() }),
    processDownload: applyDownloadedAmbiguousFormChoices,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ...ambiguousFormChoicesLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}

export async function fetchRemoteTextViaHttp(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { method: "GET", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Начало ответа: ${previewResponseText(text)}`);
  }
  return text;
}
