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
  applyFormChoicesFromRaw,
  getFormChoicesLoadStats,
  resetFormChoicesToBundled,
} from "./form-choices-store";
import {
  applyHunspellDictionaryFromRaw,
  getHunspellDictionaryLoadStats,
  resetHunspellDictionaryToBundled,
} from "../spell/hunspell-dictionary-store";
import {
  applySpellSupplementFromRaw,
  applySpellWhitelistFromRaw,
  getSpellSupplementLoadStats,
  getSpellWhitelistLoadStats,
  resetSpellSupplementToBundled,
  resetSpellWhitelistToBundled,
} from "../spell/spell-word-list-store";
import { resetSpellCheckerCache } from "../spell/spell-checker";

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

export type RefreshSpellWordListResult = {
  ok: boolean;
  wordCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshFormChoicesResult = {
  ok: boolean;
  choiceCount: number;
  fromRemote: boolean;
  errorMessage?: string;
  fetchUrl?: string;
};

export type RefreshSpellDictionaryResult = {
  ok: boolean;
  entryCount: number;
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

function formChoicesLoadCounts(): Pick<RefreshFormChoicesResult, "choiceCount"> {
  return { choiceCount: getFormChoicesLoadStats().count };
}

function spellSupplementLoadCounts(): Pick<RefreshSpellWordListResult, "wordCount"> {
  return { wordCount: getSpellSupplementLoadStats().count };
}

function spellWhitelistLoadCounts(): Pick<RefreshSpellWordListResult, "wordCount"> {
  return { wordCount: getSpellWhitelistLoadStats().count };
}

function spellDictionaryLoadCounts(): Pick<RefreshSpellDictionaryResult, "entryCount"> {
  return { entryCount: getHunspellDictionaryLoadStats().entryCount };
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

function applyDownloadedFormChoices(text: string, fetchUrl: string): RefreshFormChoicesResult {
  if (looksLikeHtmlResponse(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...formChoicesLoadCounts(),
      errorMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applyFormChoicesFromRaw(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...formChoicesLoadCounts(),
      errorMessage: `Файл получен, но choice-пары не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  invalidateAutofixRulesCache();
  return {
    ok: true,
    fromRemote: true,
    ...formChoicesLoadCounts(),
    fetchUrl,
  };
}

function applyDownloadedSpellSupplement(text: string, fetchUrl: string): RefreshSpellWordListResult {
  if (looksLikeHtmlResponse(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...spellSupplementLoadCounts(),
      errorMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applySpellSupplementFromRaw(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...spellSupplementLoadCounts(),
      errorMessage: `Файл получен, но слова не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  resetSpellCheckerCache();
  return {
    ok: true,
    fromRemote: true,
    ...spellSupplementLoadCounts(),
    fetchUrl,
  };
}

function applyDownloadedSpellWhitelist(text: string, fetchUrl: string): RefreshSpellWordListResult {
  if (looksLikeHtmlResponse(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...spellWhitelistLoadCounts(),
      errorMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      fetchUrl,
    };
  }
  if (!applySpellWhitelistFromRaw(text)) {
    return {
      ok: false,
      fromRemote: false,
      ...spellWhitelistLoadCounts(),
      errorMessage: `Файл получен, но слова не распознаны. Начало: ${previewResponseText(text)}`,
      fetchUrl,
    };
  }
  resetSpellCheckerCache();
  return {
    ok: true,
    fromRemote: true,
    ...spellWhitelistLoadCounts(),
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

/** Подтянуть choice-пары по URL; при ошибке — fallback на bundled. */
export async function refreshFormChoicesFromRemote(
  txtUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshFormChoicesResult> {
  return runRemoteRefresh(txtUrl, "form choices", fetchText, {
    resetBundled: resetFormChoicesToBundled,
    buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, ...formChoicesLoadCounts() }),
    processDownload: applyDownloadedFormChoices,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ...formChoicesLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}

/** Подтянуть доп. слова орфографии по URL; при ошибке — fallback на bundled. */
export async function refreshSpellSupplementFromRemote(
  txtUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshSpellWordListResult> {
  return runRemoteRefresh(txtUrl, "spell supplement", fetchText, {
    resetBundled: resetSpellSupplementToBundled,
    buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, ...spellSupplementLoadCounts() }),
    processDownload: applyDownloadedSpellSupplement,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ...spellSupplementLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}

/** Подтянуть whitelist орфографии по URL; при ошибке — fallback на bundled. */
export async function refreshSpellWhitelistFromRemote(
  txtUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshSpellWordListResult> {
  return runRemoteRefresh(txtUrl, "spell whitelist", fetchText, {
    resetBundled: resetSpellWhitelistToBundled,
    buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, ...spellWhitelistLoadCounts() }),
    processDownload: applyDownloadedSpellWhitelist,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ...spellWhitelistLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}

/** Подтянуть Hunspell ru_RU (.aff + .dic) по URL; при ошибке — fallback на bundled. */
export async function refreshSpellDictionaryFromRemote(
  affUrl: string,
  dicUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshSpellDictionaryResult> {
  const affFetchUrl = affUrl.trim();
  const dicFetchUrl = dicUrl.trim();

  if (!affFetchUrl || !dicFetchUrl) {
    resetHunspellDictionaryToBundled();
    resetSpellCheckerCache();
    return { ok: true, fromRemote: false, ...spellDictionaryLoadCounts() };
  }

  try {
    console.log("[text-autofix] load spell dictionary:", affFetchUrl, dicFetchUrl);
    const [aff, dic] = await Promise.all([
      fetchText(fetchUrlWithCacheBust(affFetchUrl)),
      fetchText(fetchUrlWithCacheBust(dicFetchUrl)),
    ]);
    console.log("[text-autofix] spell dictionary bytes:", aff.length, dic.length);

    if (looksLikeHtmlResponse(aff) || looksLikeHtmlResponse(dic)) {
      resetHunspellDictionaryToBundled();
      resetSpellCheckerCache();
      return {
        ok: false,
        fromRemote: false,
        ...spellDictionaryLoadCounts(),
        errorMessage: "Ответ не Hunspell (возможно HTML-страница ошибки).",
        fetchUrl: dicFetchUrl,
      };
    }

    if (!applyHunspellDictionaryFromRaw(aff, dic)) {
      resetHunspellDictionaryToBundled();
      resetSpellCheckerCache();
      return {
        ok: false,
        fromRemote: false,
        ...spellDictionaryLoadCounts(),
        errorMessage: `Hunspell получен, но не распознан. Начало .dic: ${previewResponseText(dic)}`,
        fetchUrl: dicFetchUrl,
      };
    }

    resetSpellCheckerCache();
    return {
      ok: true,
      fromRemote: true,
      ...spellDictionaryLoadCounts(),
      fetchUrl: dicFetchUrl,
    };
  } catch (e) {
    console.warn("[text-autofix] spell dictionary load failed:", e);
    resetHunspellDictionaryToBundled();
    resetSpellCheckerCache();
    return {
      ok: false,
      fromRemote: false,
      ...spellDictionaryLoadCounts(),
      errorMessage: formatFetchError(e),
      fetchUrl: dicFetchUrl,
    };
  }
}

export async function fetchRemoteTextViaHttp(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { method: "GET", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Начало ответа: ${previewResponseText(text)}`);
  }
  return text;
}
