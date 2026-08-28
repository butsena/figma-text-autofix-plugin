import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
import { BOUNDARY_EXCEPTIONS_TXT_URL } from "../config/boundary-exceptions-remote-url";
import { TEXT_REPLACEMENTS_CSV_URL } from "../config/text-replacements-remote-url";
import {
  fetchRemoteTextViaHttp,
  refreshBoundaryExceptionsFromRemote,
  refreshTextReplacementsFromRemote,
  type RefreshBoundaryExceptionsResult,
  type RefreshLexiconReplacementsResult,
} from "./refresh-from-remote";

let cachedLexiconStatus: LexiconLoadStatusDto | null = null;

function toResourceStatus(
  result: RefreshLexiconReplacementsResult | RefreshBoundaryExceptionsResult,
): LexiconResourceLoadStatus {
  return {
    ok: result.ok,
    count: "ruleCount" in result ? result.ruleCount : result.phraseCount,
    fromRemote: result.fromRemote,
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    ...(result.fetchUrl ? { fetchUrl: result.fetchUrl } : {}),
  };
}

export function mergeLexiconLoadStatus(
  replacements: RefreshLexiconReplacementsResult,
  boundaryExceptions: RefreshBoundaryExceptionsResult,
): LexiconLoadStatusDto {
  return {
    replacements: toResourceStatus(replacements),
    boundaryExceptions: toResourceStatus(boundaryExceptions),
  };
}

export function resetLexiconLoadCache(): void {
  cachedLexiconStatus = null;
}

/** Подтянуть CSV замен и список исключений границы с GitHub (параллельно). */
export async function refreshLexiconFromRemote(
  options?: { force?: boolean },
): Promise<LexiconLoadStatusDto> {
  if (cachedLexiconStatus && !options?.force) {
    return cachedLexiconStatus;
  }

  const [replacements, boundaryExceptions] = await Promise.all([
    refreshTextReplacementsFromRemote(TEXT_REPLACEMENTS_CSV_URL, fetchRemoteTextViaHttp),
    refreshBoundaryExceptionsFromRemote(BOUNDARY_EXCEPTIONS_TXT_URL, fetchRemoteTextViaHttp),
  ]);

  if (!replacements.ok) {
    console.warn("[text-autofix] lexicon load failed, using bundled CSV", replacements);
  }
  if (!boundaryExceptions.ok) {
    console.warn(
      "[text-autofix] boundary exceptions load failed, using bundled list",
      boundaryExceptions,
    );
  }

  cachedLexiconStatus = mergeLexiconLoadStatus(replacements, boundaryExceptions);
  return cachedLexiconStatus;
}
