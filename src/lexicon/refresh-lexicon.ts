import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
import { SPELLCHECK_ENABLED } from "../config/feature-flags";
import { LEXICON_REMOTE } from "../config/lexicon-remote-config";
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
    refreshTextReplacementsFromRemote(LEXICON_REMOTE.replacements.url, fetchRemoteTextViaHttp),
    refreshBoundaryExceptionsFromRemote(
      LEXICON_REMOTE.boundaryExceptions.url,
      fetchRemoteTextViaHttp,
    ),
    refreshAmbiguousFormChoicesFromRemote(
      LEXICON_REMOTE.ambiguousFormChoices.url,
      fetchRemoteTextViaHttp,
    ),
  ]);

  let spellDictionary: RefreshSpellDictionaryResult;
  let spellSupplement: RefreshSpellWordListResult;
  let spellWhitelist: RefreshSpellWordListResult;

  if (SPELLCHECK_ENABLED) {
    [spellDictionary, spellSupplement, spellWhitelist] = await Promise.all([
      refreshSpellDictionaryFromRemote(
        LEXICON_REMOTE.spellDictionary.affUrl,
        LEXICON_REMOTE.spellDictionary.dicUrl,
        fetchRemoteTextViaHttp,
      ),
      refreshSpellSupplementFromRemote(
        LEXICON_REMOTE.spellSupplement.url,
        fetchRemoteTextViaHttp,
      ),
      refreshSpellWhitelistFromRemote(LEXICON_REMOTE.spellWhitelist.url, fetchRemoteTextViaHttp),
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
