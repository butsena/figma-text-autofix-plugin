import { LEXICON_REMOTE } from "./lexicon-remote-config";

/** Public-репозиторий орфографии (словарь + доп. слова + исключения). */
export const SPELL_DICTIONARY_REPO = LEXICON_REMOTE.spellDictionary.repo;

/** GitHub raw URL Hunspell ru_RU (ветка main). */
export const SPELL_DICTIONARY_AFF_URL = LEXICON_REMOTE.spellDictionary.affUrl;

export const SPELL_DICTIONARY_DIC_URL = LEXICON_REMOTE.spellDictionary.dicUrl;

export const SPELL_SUPPLEMENT_TXT_URL = LEXICON_REMOTE.spellSupplement.url;

export const SPELL_WHITELIST_TXT_URL = LEXICON_REMOTE.spellWhitelist.url;
