import { invalidateAutofixRulesCache } from "../rules/autofix-rules";
import {
  fetchUrlWithCacheBust,
  looksLikeHtmlResponse,
  previewResponseText,
} from "./remote-fetch";

export type RemoteRefreshHandlers<TResult extends { ok: boolean; fromRemote: boolean }> = {
  resetBundled: () => void;
  buildEmptyUrlResult: () => TResult;
  processDownload: (text: string, fetchUrl: string) => TResult;
  buildNetworkErrorResult: (fetchUrl: string, error: unknown) => TResult;
};

export type DownloadResourceConfig<TCounts extends Record<string, number>> = {
  invalidFormatMessage: string;
  unrecognizedMessage: string;
  getCounts: () => TCounts;
  apply: (text: string) => boolean;
};

export async function runRemoteRefresh<TResult extends { ok: boolean; fromRemote: boolean }>(
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

export function applyDownloadedResource<TCounts extends Record<string, number>, TResult>(
  text: string,
  fetchUrl: string,
  config: DownloadResourceConfig<TCounts>,
  buildFailure: (counts: TCounts, errorMessage: string, fetchUrl: string) => TResult,
  buildSuccess: (counts: TCounts, fetchUrl: string) => TResult,
): TResult {
  if (looksLikeHtmlResponse(text)) {
    return buildFailure(config.getCounts(), config.invalidFormatMessage, fetchUrl);
  }
  if (!config.apply(text)) {
    return buildFailure(
      config.getCounts(),
      `${config.unrecognizedMessage}: ${previewResponseText(text)}`,
      fetchUrl,
    );
  }

  invalidateAutofixRulesCache();
  return buildSuccess(config.getCounts(), fetchUrl);
}
