import { formatFetchError } from "./remote-fetch";
import { applyDownloadedResource, runRemoteRefresh } from "./remote-refresh-runner";
import type {
  RefreshAmbiguousFormChoicesResult,
  RefreshBoundaryExceptionsResult,
  RefreshLexiconReplacementsResult,
} from "./remote-refresh-types";
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
} from "./ambiguous-form-choices-store";

export type {
  RefreshAmbiguousFormChoicesResult,
  RefreshBoundaryExceptionsResult,
  RefreshLexiconReplacementsResult,
  RefreshSpellDictionaryResult,
  RefreshSpellWordListResult,
} from "./remote-refresh-types";

export {
  fetchRemoteTextViaHttp,
  refreshSpellDictionaryFromRemote,
  refreshSpellSupplementFromRemote,
  refreshSpellWhitelistFromRemote,
} from "./refresh-spell-from-remote";

function applyDownloadedCsv(text: string, fetchUrl: string): RefreshLexiconReplacementsResult {
  return applyDownloadedResource(
    text,
    fetchUrl,
    {
      invalidFormatMessage: "Ответ не CSV (возможно HTML-страница ошибки).",
      unrecognizedMessage: "CSV получен, но правила не распознаны. Начало",
      getCounts: () => ({ ruleCount: getLexiconRulesLoadStats().totalCount }),
      apply: applyLexiconReplacementsFromCsv,
    },
    (counts, errorMessage, url) => ({
      ok: false,
      fromRemote: false,
      ...counts,
      errorMessage,
      fetchUrl: url,
    }),
    (counts, url) => ({
      ok: true,
      fromRemote: true,
      ...counts,
      fetchUrl: url,
    }),
  );
}

function applyDownloadedBoundaryExceptions(
  text: string,
  fetchUrl: string,
): RefreshBoundaryExceptionsResult {
  return applyDownloadedResource(
    text,
    fetchUrl,
    {
      invalidFormatMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      unrecognizedMessage: "Файл получен, но фразы не распознаны. Начало",
      getCounts: () => ({ phraseCount: getBoundaryExceptionsLoadStats().count }),
      apply: applyBoundaryExceptionsFromRaw,
    },
    (counts, errorMessage, url) => ({
      ok: false,
      fromRemote: false,
      ...counts,
      errorMessage,
      fetchUrl: url,
    }),
    (counts, url) => ({
      ok: true,
      fromRemote: true,
      ...counts,
      fetchUrl: url,
    }),
  );
}

function applyDownloadedAmbiguousFormChoices(
  text: string,
  fetchUrl: string,
): RefreshAmbiguousFormChoicesResult {
  return applyDownloadedResource(
    text,
    fetchUrl,
    {
      invalidFormatMessage: "Ответ не текстовый список (возможно HTML-страница ошибки).",
      unrecognizedMessage: "Файл получен, но пары не распознаны. Начало",
      getCounts: () => ({ choiceCount: getAmbiguousFormChoicesLoadStats().count }),
      apply: applyAmbiguousFormChoicesFromRaw,
    },
    (counts, errorMessage, url) => ({
      ok: false,
      fromRemote: false,
      ...counts,
      errorMessage,
      fetchUrl: url,
    }),
    (counts, url) => ({
      ok: true,
      fromRemote: true,
      ...counts,
      fetchUrl: url,
    }),
  );
}

/** Подтянуть CSV словаря замен по URL; при ошибке — fallback на bundled. */
export async function refreshTextReplacementsFromRemote(
  csvUrl: string,
  fetchText: (fetchUrl: string) => Promise<string>,
): Promise<RefreshLexiconReplacementsResult> {
  return runRemoteRefresh(csvUrl, "CSV", fetchText, {
    resetBundled: resetLexiconReplacementsToBundled,
    buildEmptyUrlResult: () => ({
      ok: true,
      fromRemote: false,
      ruleCount: getLexiconRulesLoadStats().totalCount,
    }),
    processDownload: applyDownloadedCsv,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      ruleCount: getLexiconRulesLoadStats().totalCount,
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
    buildEmptyUrlResult: () => ({
      ok: true,
      fromRemote: false,
      phraseCount: getBoundaryExceptionsLoadStats().count,
    }),
    processDownload: applyDownloadedBoundaryExceptions,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      phraseCount: getBoundaryExceptionsLoadStats().count,
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
    buildEmptyUrlResult: () => ({
      ok: true,
      fromRemote: false,
      choiceCount: getAmbiguousFormChoicesLoadStats().count,
    }),
    processDownload: applyDownloadedAmbiguousFormChoices,
    buildNetworkErrorResult: (fetchUrl, e) => ({
      ok: false,
      fromRemote: false,
      choiceCount: getAmbiguousFormChoicesLoadStats().count,
      errorMessage: formatFetchError(e),
      fetchUrl,
    }),
  });
}
