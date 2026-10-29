import {
  formatFetchError,
  looksLikeHtmlResponse,
  previewResponseText,
} from "./remote-fetch";
import { trackPluginError } from "../analytics/pipeline-events";
import {
  getFigmaSpellDictionaryCacheStore,
  packSpellDictionary,
  spellDictionaryCacheSkipsNetwork,
  unpackSpellDictionary,
  type SpellDictionaryCacheRecord,
  type SpellDictionaryCacheStore,
} from "../spell/spell-dictionary-cache";
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
  }, "spell_supplement");
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
  }, "spell_whitelist");
}

export type SpellDictionaryFetchResult =
  | { kind: "not-modified" }
  | { kind: "body"; text: string; etag: string | null };

export type SpellDictionaryLoadIo = {
  /** Если нет — качаем тело через fetchText, без cache-bust (тесты). */
  fetchFile?: (url: string, knownEtag: string | null) => Promise<SpellDictionaryFetchResult>;
  /** null — не писать кэш. Если ключа нет — clientStorage плагина, когда он есть. */
  cache?: SpellDictionaryCacheStore | null;
};

type LoadedSpellPart = {
  text: string;
  etag: string | null;
  downloaded: boolean;
};

function resolveSpellDictionaryCache(
  io?: SpellDictionaryLoadIo,
): SpellDictionaryCacheStore | null {
  if (io && "cache" in io) return io.cache ?? null;
  return getFigmaSpellDictionaryCacheStore();
}

function failSpellDictionary(
  errorMessage: string,
  fetchUrl: string,
): RefreshSpellDictionaryResult {
  clearHunspellDictionary();
  resetSpellCheckerCache();
  trackPluginError("spell", null, {
    code: "spell_load_failed", resource: "spell_dictionary",
  });
  return {
    ok: false,
    fromRemote: false,
    ...spellDictionaryLoadCounts(),
    errorMessage,
    fetchUrl,
  };
}

function spellDictionaryFromCache(
  unpacked: { aff: string; dic: string } | null,
  fetchUrl: string,
  warn: string,
): RefreshSpellDictionaryResult | null {
  if (!unpacked || !applyHunspellDictionaryFromRaw(unpacked.aff, unpacked.dic)) return null;
  resetSpellCheckerCache();
  trackPluginError("spell", null, {
    code: "spell_load_failed", outcome: "recovered",
    resource: "spell_dictionary", recovery: "cache",
  });
  console.warn(warn);
  return {
    ok: true,
    fromRemote: true,
    ...spellDictionaryLoadCounts(),
    fetchUrl,
  };
}

async function loadSpellPart(
  url: string,
  knownEtag: string | null,
  cachedText: string | null,
  fetchText: (fetchUrl: string) => Promise<string>,
  fetchFile?: (url: string, knownEtag: string | null) => Promise<SpellDictionaryFetchResult>,
): Promise<LoadedSpellPart> {
  if (!fetchFile) {
    return { text: await fetchText(url), etag: null, downloaded: true };
  }

  const result = await fetchFile(url, knownEtag);
  if (result.kind === "body") {
    return { text: result.text, etag: result.etag, downloaded: true };
  }
  if (cachedText == null) {
    const again = await fetchFile(url, null);
    if (again.kind === "not-modified") {
      throw new Error("Словарь не изменился, но локальной копии нет.");
    }
    return { text: again.text, etag: again.etag, downloaded: true };
  }
  return { text: cachedText, etag: knownEtag, downloaded: false };
}

function logSpellDictionaryCacheHit(record: SpellDictionaryCacheRecord): void {
  console.log(
    "[text-autofix] spell dictionary cache hit, hash",
    record.hashAff,
    record.hashDic,
  );
}

function cacheHitResult(
  record: SpellDictionaryCacheRecord,
  fetchUrl: string,
): RefreshSpellDictionaryResult {
  logSpellDictionaryCacheHit(record);
  return {
    ok: true,
    fromRemote: true,
    ...spellDictionaryLoadCounts(),
    fetchUrl,
  };
}

/**
 * Hunspell .aff/.dic без cache-bust. Повторный запуск с тем же ETag не качает тело.
 * В Figma ETag не виден — свежая gzip-копия в clientStorage используется без сети до суток.
 * Нет сети и нет копии — орфография выключена.
 */
export async function refreshSpellDictionaryFromRemote(
  affUrl: string,
  dicUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
  io?: SpellDictionaryLoadIo,
): Promise<RefreshSpellDictionaryResult> {
  const affFetchUrl = affUrl.trim();
  const dicFetchUrl = dicUrl.trim();

  if (!affFetchUrl || !dicFetchUrl) {
    clearHunspellDictionary();
    resetSpellCheckerCache();
    return { ok: true, fromRemote: false, ...spellDictionaryLoadCounts() };
  }

  const cacheStore = resolveSpellDictionaryCache(io);
  const cachedRecord = cacheStore ? await cacheStore.get() : null;
  const unpacked = cachedRecord ? unpackSpellDictionary(cachedRecord) : null;

  try {
    console.log("[text-autofix] load spell dictionary:", affFetchUrl, dicFetchUrl);
    if (
      unpacked &&
      cachedRecord &&
      cacheStore &&
      spellDictionaryCacheSkipsNetwork(cachedRecord) &&
      applyHunspellDictionaryFromRaw(unpacked.aff, unpacked.dic)
    ) {
      resetSpellCheckerCache();
      if (cachedRecord.savedAt == null) {
        await cacheStore.set({ ...cachedRecord, savedAt: Date.now() });
      }
      return cacheHitResult(cachedRecord, dicFetchUrl);
    }

    const knownAffEtag = unpacked ? (cachedRecord?.etagAff ?? null) : null;
    const knownDicEtag = unpacked ? (cachedRecord?.etagDic ?? null) : null;
    const [affPart, dicPart] = await Promise.all([
      loadSpellPart(affFetchUrl, knownAffEtag, unpacked?.aff ?? null, fetchText, io?.fetchFile),
      loadSpellPart(dicFetchUrl, knownDicEtag, unpacked?.dic ?? null, fetchText, io?.fetchFile),
    ]);
    const downloaded = affPart.downloaded || dicPart.downloaded;
    if (downloaded) {
      console.log("[text-autofix] spell dictionary bytes:", affPart.text.length, dicPart.text.length);
    } else if (cachedRecord) {
      logSpellDictionaryCacheHit(cachedRecord);
    }

    if (looksLikeHtmlResponse(affPart.text) || looksLikeHtmlResponse(dicPart.text)) {
      return (
        spellDictionaryFromCache(
          unpacked,
          dicFetchUrl,
          "[text-autofix] spell dictionary response unusable, using cache",
        ) ??
        failSpellDictionary(
          "Ответ не орфографический словарь (возможно HTML-страница ошибки).",
          dicFetchUrl,
        )
      );
    }

    if (!applyHunspellDictionaryFromRaw(affPart.text, dicPart.text)) {
      return (
        spellDictionaryFromCache(
          unpacked,
          dicFetchUrl,
          "[text-autofix] spell dictionary response unusable, using cache",
        ) ??
        failSpellDictionary(
          `Словарь получен, но не распознан. Начало .dic: ${previewResponseText(dicPart.text)}`,
          dicFetchUrl,
        )
      );
    }

    resetSpellCheckerCache();
    if (cacheStore && downloaded) {
      try {
        const packed = packSpellDictionary(
          affPart.text,
          dicPart.text,
          affPart.etag,
          dicPart.etag,
        );
        if (packed) await cacheStore.set(packed);
      } catch (error) {
        console.warn("[text-autofix] spell dictionary cache write failed", error);
      }
    }

    return {
      ok: true,
      fromRemote: true,
      ...spellDictionaryLoadCounts(),
      fetchUrl: dicFetchUrl,
    };
  } catch (e) {
    console.warn("[text-autofix] spell dictionary load failed:", e);
    const cached = spellDictionaryFromCache(
      unpacked,
      dicFetchUrl,
      "[text-autofix] spell dictionary offline, using cache",
    );
    if (cached) return cached;
    return failSpellDictionary(formatFetchError(e), dicFetchUrl);
  }
}

/**
 * ETag из ответа. В песочнице Figma у fetch бывает нет headers —
 * тогда словарь всё равно берём, просто без условного запроса в следующий раз.
 */
export function readResponseEtag(res: { headers?: unknown }): string | null {
  const headers = res.headers;
  if (!headers || typeof headers !== "object") return null;
  try {
    const getter = (headers as { get?: unknown }).get;
    if (typeof getter === "function") {
      const value = getter.call(headers, "etag");
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }
    const record = headers as Record<string, unknown>;
    const raw = record.etag ?? record.ETag ?? record.Etag;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

/** GET .aff/.dic. Совпал ETag — 304, тело не читаем. Без ?t= . */
export async function fetchSpellDictionaryFile(
  url: string,
  knownEtag: string | null,
): Promise<SpellDictionaryFetchResult> {
  const init: RequestInit = { method: "GET", cache: "no-store" };
  if (knownEtag) init.headers = { "If-None-Match": knownEtag };
  const res = await fetch(url, init);
  if (res.status === 304) return { kind: "not-modified" };
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Начало ответа: ${previewResponseText(text)}`);
  }
  return { kind: "body", text, etag: readResponseEtag(res) };
}

export async function fetchRemoteTextViaHttp(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, { method: "GET", cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}. Начало ответа: ${previewResponseText(text)}`);
  }
  return text;
}
