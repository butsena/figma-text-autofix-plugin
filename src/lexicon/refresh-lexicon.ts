import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
import { SPELLCHECK_ENABLED } from "../config/feature-flags";
import { AMBIGUOUS_FORM_CHOICES_TXT_URL } from "../config/ambiguous-form-choices-remote-url";
import { BOUNDARY_EXCEPTIONS_TXT_URL } from "../config/boundary-exceptions-remote-url";
import {
  SPELL_DICTIONARY_AFF_URL,
  SPELL_DICTIONARY_DIC_URL,
  SPELL_SUPPLEMENT_TXT_URL,
  SPELL_WHITELIST_TXT_URL,
} from "../config/spell-dictionary-remote-url";
import { TEXT_REPLACEMENTS_CSV_URL } from "../config/text-replacements-remote-url";
import {
  fetchRemoteTextViaHttp,
  refreshAmbiguousFormChoicesFromRemote,
  refreshBoundaryExceptionsFromRemote,
  refreshSpellDictionaryFromRemote,
  refreshSpellSupplementFromRemote,
  refreshSpellWhitelistFromRemote,
  refreshTextReplacementsFromRemote,
  type RefreshAmbiguousFormChoicesResult,
  type RefreshBoundaryExceptionsResult,
  type RefreshLexiconReplacementsResult,
  type RefreshSpellDictionaryResult,
  type RefreshSpellWordListResult,
} from "./refresh-from-remote";
import { clearHunspellDictionary } from "../spell/hunspell-dictionary-store";
import { resetSpellCheckerCache } from "../spell/spell-checker";

let cachedLexiconStatus: LexiconLoadStatusDto | null = null;

const DISABLED_SPELL_DICTIONARY: RefreshSpellDictionaryResult = {
  ok: true,
  entryCount: 0,
  fromRemote: false,
};

const DISABLED_SPELL_WORD_LIST: RefreshSpellWordListResult = {
  ok: true,
  wordCount: 0,
  fromRemote: false,
};

function toResourceStatus(
  result:
    | RefreshLexiconReplacementsResult
    | RefreshBoundaryExceptionsResult
    | RefreshAmbiguousFormChoicesResult
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
  ambiguousFormChoices: RefreshAmbiguousFormChoicesResult,
  spellDictionary: RefreshSpellDictionaryResult,
  spellSupplement: RefreshSpellWordListResult,
  spellWhitelist: RefreshSpellWordListResult,
): LexiconLoadStatusDto {
  return {
    replacements: toResourceStatus(replacements),
    boundaryExceptions: toResourceStatus(boundaryExceptions),
    ambiguousFormChoices: toResourceStatus(ambiguousFormChoices),
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

  const [replacements, boundaryExceptions, ambiguousFormChoices] = await Promise.all([
    refreshTextReplacementsFromRemote(TEXT_REPLACEMENTS_CSV_URL, fetchRemoteTextViaHttp),
    refreshBoundaryExceptionsFromRemote(BOUNDARY_EXCEPTIONS_TXT_URL, fetchRemoteTextViaHttp),
    refreshAmbiguousFormChoicesFromRemote(
      AMBIGUOUS_FORM_CHOICES_TXT_URL,
      fetchRemoteTextViaHttp,
    ),
  ]);

  let spellDictionary: RefreshSpellDictionaryResult;
  let spellSupplement: RefreshSpellWordListResult;
  let spellWhitelist: RefreshSpellWordListResult;

  if (SPELLCHECK_ENABLED) {
    [spellDictionary, spellSupplement, spellWhitelist] = await Promise.all([
      refreshSpellDictionaryFromRemote(
        SPELL_DICTIONARY_AFF_URL,
        SPELL_DICTIONARY_DIC_URL,
        fetchRemoteTextViaHttp,
      ),
      refreshSpellSupplementFromRemote(SPELL_SUPPLEMENT_TXT_URL, fetchRemoteTextViaHttp),
      refreshSpellWhitelistFromRemote(SPELL_WHITELIST_TXT_URL, fetchRemoteTextViaHttp),
    ]);
  } else {
    clearHunspellDictionary();
    resetSpellCheckerCache();
    spellDictionary = DISABLED_SPELL_DICTIONARY;
    spellSupplement = DISABLED_SPELL_WORD_LIST;
    spellWhitelist = DISABLED_SPELL_WORD_LIST;
  }

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
  if (SPELLCHECK_ENABLED) {
    if (!spellDictionary.ok) {
      console.warn(
        "[text-autofix] spell dictionary load failed — orthography disabled until GitHub is available",
        spellDictionary,
      );
    }
    if (!spellSupplement.ok) {
      console.warn(
        "[text-autofix] spell supplement load failed, using bundled list",
        spellSupplement,
      );
    }
    if (!spellWhitelist.ok) {
      console.warn(
        "[text-autofix] spell whitelist load failed, using bundled list",
        spellWhitelist,
      );
    }
  }

  cachedLexiconStatus = mergeLexiconLoadStatus(
    replacements,
    boundaryExceptions,
    ambiguousFormChoices,
    spellDictionary,
    spellSupplement,
    spellWhitelist,
  );
  return cachedLexiconStatus;
}
