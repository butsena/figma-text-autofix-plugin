import {
  fetchUrlWithCacheBust,
  formatFetchError,
  looksLikeHtmlResponse,
  previewResponseText,
} from "./remote-fetch";
import { runRemoteRefresh } from "./remote-refresh-runner";
import type {
  RefreshSpellDictionaryResult,
  RefreshSpellWordListResult,
} from "./remote-refresh-types";
import {
  applyHunspellDictionaryFromRaw,
  clearHunspellDictionary,
  getHunspellDictionaryLoadStats,
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

function spellSupplementLoadCounts(): Pick<RefreshSpellWordListResult, "wordCount"> {
  return { wordCount: getSpellSupplementLoadStats().count };
}

function spellWhitelistLoadCounts(): Pick<RefreshSpellWordListResult, "wordCount"> {
  return { wordCount: getSpellWhitelistLoadStats().count };
}

function spellDictionaryLoadCounts(): Pick<RefreshSpellDictionaryResult, "entryCount"> {
  return { entryCount: getHunspellDictionaryLoadStats().entryCount };
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

/** Подтянуть Hunspell ru_RU (.aff + .dic) по URL; при ошибке — орфография отключается (бандла нет). */
export async function refreshSpellDictionaryFromRemote(
  affUrl: string,
  dicUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshSpellDictionaryResult> {
  const affFetchUrl = affUrl.trim();
  const dicFetchUrl = dicUrl.trim();

  if (!affFetchUrl || !dicFetchUrl) {
    clearHunspellDictionary();
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
      clearHunspellDictionary();
      resetSpellCheckerCache();
      return {
        ok: false,
        fromRemote: false,
        ...spellDictionaryLoadCounts(),
        errorMessage: "Ответ не орфографический словарь (возможно HTML-страница ошибки).",
        fetchUrl: dicFetchUrl,
      };
    }

    if (!applyHunspellDictionaryFromRaw(aff, dic)) {
      clearHunspellDictionary();
      resetSpellCheckerCache();
      return {
        ok: false,
        fromRemote: false,
        ...spellDictionaryLoadCounts(),
        errorMessage: `Словарь получен, но не распознан. Начало .dic: ${previewResponseText(dic)}`,
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
    clearHunspellDictionary();
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
