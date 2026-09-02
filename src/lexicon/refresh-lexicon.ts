import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
import { AMBIGUOUS_FORM_CHOICES_TXT_URL } from "../config/ambiguous-form-choices-remote-url";
import { BOUNDARY_EXCEPTIONS_TXT_URL } from "../config/boundary-exceptions-remote-url";
import { TEXT_REPLACEMENTS_CSV_URL } from "../config/text-replacements-remote-url";
import {
  fetchRemoteTextViaHttp,
  refreshAmbiguousFormChoicesFromRemote,
  refreshBoundaryExceptionsFromRemote,
  refreshTextReplacementsFromRemote,
  type RefreshAmbiguousFormChoicesResult,
  type RefreshBoundaryExceptionsResult,
  type RefreshLexiconReplacementsResult,
} from "./refresh-from-remote";

let cachedLexiconStatus: LexiconLoadStatusDto | null = null;

function toResourceStatus(
  result:
    | RefreshLexiconReplacementsResult
    | RefreshBoundaryExceptionsResult
    | RefreshAmbiguousFormChoicesResult,
): LexiconResourceLoadStatus {
  const count =
    "ruleCount" in result
      ? result.ruleCount
      : "phraseCount" in result
        ? result.phraseCount
        : result.choiceCount;

  return {
    ok: result.ok,
    count,
    fromRemote: result.fromRemote,
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    ...(result.fetchUrl ? { fetchUrl: result.fetchUrl } : {}),
  };
}

export function mergeLexiconLoadStatus(
  replacements: RefreshLexiconReplacementsResult,
  boundaryExceptions: RefreshBoundaryExceptionsResult,
  ambiguousFormChoices: RefreshAmbiguousFormChoicesResult,
): LexiconLoadStatusDto {
  return {
    replacements: toResourceStatus(replacements),
    boundaryExceptions: toResourceStatus(boundaryExceptions),
    ambiguousFormChoices: toResourceStatus(ambiguousFormChoices),
  };
}

export function resetLexiconLoadCache(): void {
  cachedLexiconStatus = null;
}

/** Подтянуть CSV замен, исключения границ и пары choice-правил с GitHub (параллельно). */
export async function refreshLexiconFromRemote(
  options?: { force?: boolean },
): Promise<LexiconLoadStatusDto> {
  if (cachedLexiconStatus && !options?.force) {
    return cachedLexiconStatus;
  }

  const [replacements, boundaryExceptions, ambiguousFormChoices] = await Promise.all([
    refreshTextReplacementsFromRemote(TEXT_REPLACEMENTS_CSV_URL, fetchRemoteTextViaHttp),
    refreshBoundaryExceptionsFromRemote(BOUNDARY_EXCEPTIONS_TXT_URL, fetchRemoteTextViaHttp),
    refreshAmbiguousFormChoicesFromRemote(
      AMBIGUOUS_FORM_CHOICES_TXT_URL,
      fetchRemoteTextViaHttp,
    ),
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
  if (!ambiguousFormChoices.ok) {
    console.warn(
      "[text-autofix] ambiguous form choices load failed, using bundled list",
      ambiguousFormChoices,
    );
  }

  cachedLexiconStatus = mergeLexiconLoadStatus(
    replacements,
    boundaryExceptions,
    ambiguousFormChoices,
  );
  return cachedLexiconStatus;
}
