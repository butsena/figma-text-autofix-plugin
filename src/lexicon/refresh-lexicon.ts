import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
import { BOUNDARY_EXCEPTIONS_TXT_URL } from "../config/boundary-exceptions-remote-url";
import { FORM_CHOICES_TXT_URL } from "../config/form-choices-remote-url";
import {
  SPELL_DICTIONARY_AFF_URL,
  SPELL_DICTIONARY_DIC_URL,
  SPELL_SUPPLEMENT_TXT_URL,
  SPELL_WHITELIST_TXT_URL,
} from "../config/spell-dictionary-remote-url";
import { TEXT_REPLACEMENTS_CSV_URL } from "../config/text-replacements-remote-url";
import {
  fetchRemoteTextViaHttp,
  refreshBoundaryExceptionsFromRemote,
  refreshFormChoicesFromRemote,
  refreshSpellDictionaryFromRemote,
  refreshSpellSupplementFromRemote,
  refreshSpellWhitelistFromRemote,
  refreshTextReplacementsFromRemote,
  type RefreshBoundaryExceptionsResult,
  type RefreshFormChoicesResult,
  type RefreshLexiconReplacementsResult,
  type RefreshSpellDictionaryResult,
  type RefreshSpellWordListResult,
} from "./refresh-from-remote";

let cachedLexiconStatus: LexiconLoadStatusDto | null = null;

function toResourceStatus(
  result:
    | RefreshLexiconReplacementsResult
    | RefreshBoundaryExceptionsResult
    | RefreshFormChoicesResult
    | RefreshSpellDictionaryResult
    | RefreshSpellWordListResult,
): LexiconResourceLoadStatus {
  return {
    ok: result.ok,
    count:
      "ruleCount" in result
        ? result.ruleCount
        : "phraseCount" in result
          ? result.phraseCount
          : "choiceCount" in result
            ? result.choiceCount
            : "entryCount" in result
              ? result.entryCount
              : result.wordCount,
    fromRemote: result.fromRemote,
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    ...(result.fetchUrl ? { fetchUrl: result.fetchUrl } : {}),
  };
}

export function mergeLexiconLoadStatus(
  replacements: RefreshLexiconReplacementsResult,
  boundaryExceptions: RefreshBoundaryExceptionsResult,
  formChoices: RefreshFormChoicesResult,
  spellDictionary: RefreshSpellDictionaryResult,
  spellSupplement: RefreshSpellWordListResult,
  spellWhitelist: RefreshSpellWordListResult,
): LexiconLoadStatusDto {
  return {
    replacements: toResourceStatus(replacements),
    boundaryExceptions: toResourceStatus(boundaryExceptions),
    formChoices: toResourceStatus(formChoices),
    spellDictionary: toResourceStatus(spellDictionary),
    spellSupplement: toResourceStatus(spellSupplement),
    spellWhitelist: toResourceStatus(spellWhitelist),
  };
}

export function resetLexiconLoadCache(): void {
  cachedLexiconStatus = null;
}

/** Подтянуть словари с GitHub (параллельно). */
export async function refreshLexiconFromRemote(
  options?: { force?: boolean },
): Promise<LexiconLoadStatusDto> {
  if (cachedLexiconStatus && !options?.force) {
    return cachedLexiconStatus;
  }

  const [
    replacements,
    boundaryExceptions,
    formChoices,
    spellDictionary,
    spellSupplement,
    spellWhitelist,
  ] = await Promise.all([
    refreshTextReplacementsFromRemote(TEXT_REPLACEMENTS_CSV_URL, fetchRemoteTextViaHttp),
    refreshBoundaryExceptionsFromRemote(BOUNDARY_EXCEPTIONS_TXT_URL, fetchRemoteTextViaHttp),
    refreshFormChoicesFromRemote(FORM_CHOICES_TXT_URL, fetchRemoteTextViaHttp),
    refreshSpellDictionaryFromRemote(
      SPELL_DICTIONARY_AFF_URL,
      SPELL_DICTIONARY_DIC_URL,
      fetchRemoteTextViaHttp,
    ),
    refreshSpellSupplementFromRemote(SPELL_SUPPLEMENT_TXT_URL, fetchRemoteTextViaHttp),
    refreshSpellWhitelistFromRemote(SPELL_WHITELIST_TXT_URL, fetchRemoteTextViaHttp),
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
  if (!formChoices.ok) {
    console.warn("[text-autofix] form choices load failed, using bundled list", formChoices);
  }
  if (!spellDictionary.ok) {
    console.warn("[text-autofix] spell dictionary load failed, using bundled Hunspell", spellDictionary);
  }
  if (!spellSupplement.ok) {
    console.warn("[text-autofix] spell supplement load failed, using bundled list", spellSupplement);
  }
  if (!spellWhitelist.ok) {
    console.warn("[text-autofix] spell whitelist load failed, using bundled list", spellWhitelist);
  }

  cachedLexiconStatus = mergeLexiconLoadStatus(
    replacements,
    boundaryExceptions,
    formChoices,
    spellDictionary,
    spellSupplement,
    spellWhitelist,
  );
  return cachedLexiconStatus;
}
