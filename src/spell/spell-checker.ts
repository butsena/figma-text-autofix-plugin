import { SPELLCHECK_ENABLED } from "../config/feature-flags";
import nspell from "nspell";
import { getAllSpellExtraWords } from "./spell-word-list-store";
import {
  getHunspellDictionary,
  getHunspellDictionaryLoadStats,
  HUNSPELL_SOURCE,
} from "./hunspell-dictionary-store";

export type SpellChecker = ReturnType<typeof nspell>;

export { HUNSPELL_SOURCE };

let checker: SpellChecker | null = null;
let initPromise: Promise<SpellChecker | null> | null = null;
let signature = "";
let buildingSignature = "";

function buildChecker(): SpellChecker | null {
  const dict = getHunspellDictionary();
  if (!dict) return null;
  const spell = nspell(dict.aff, dict.dic);
  for (const word of getAllSpellExtraWords()) {
    spell.add(word.toLowerCase());
  }
  return spell;
}

function currentSignature(): string {
  const stats = getHunspellDictionaryLoadStats();
  const dict = getHunspellDictionary();
  const extra = getAllSpellExtraWords();
  return `${stats.fromRemote ? "remote" : "none"}:${dict?.entryCount ?? 0}:${extra.join("\u0000")}`;
}

/**
 * Ленивая инициализация Hunspell после загрузки словаря с GitHub.
 * Без remote-словаря возвращает null — орфопроверка просто пропускается.
 */
export async function ensureSpellCheckerReady(): Promise<SpellChecker | null> {
  if (!SPELLCHECK_ENABLED) {
    checker = null;
    initPromise = null;
    signature = "";
    buildingSignature = "";
    return null;
  }

  const nextSignature = currentSignature();

  if (!getHunspellDictionary()) {
    checker = null;
    initPromise = null;
    signature = nextSignature;
    buildingSignature = "";
    return null;
  }

  if (checker && signature === nextSignature) {
    return checker;
  }

  if (initPromise && buildingSignature === nextSignature) {
    return initPromise;
  }

  buildingSignature = nextSignature;
  initPromise = Promise.resolve().then(() => {
    const started = Date.now();
    checker = buildChecker();
    signature = nextSignature;
    buildingSignature = "";
    const stats = getHunspellDictionaryLoadStats();
    if (checker) {
      console.log(
        `[text-autofix] Hunspell ready (${HUNSPELL_SOURCE}, ${stats.entryCount} entries) in ${Date.now() - started} ms`,
      );
    }
    return checker;
  });

  return initPromise;
}

export function getSpellChecker(): SpellChecker | null {
  return checker;
}

const suggestionByLower = new Map<string, string | null>();
let spellSuggestMisses = 0;

export function getSpellSuggestMissCount(): number {
  return spellSuggestMisses;
}

/** Кэш suggest на сессию плагина. Сброс вместе со словарём. */
export function resetSpellSuggestionCache(): void {
  suggestionByLower.clear();
  spellSuggestMisses = 0;
}

export function resetSpellCheckerCache(): void {
  checker = null;
  initPromise = null;
  signature = "";
  buildingSignature = "";
  resetSpellSuggestionCache();
}

export function isKnownWord(spell: SpellChecker, word: string): boolean {
  if (!word) return true;
  if (spell.correct(word)) return true;
  const lower = word.toLowerCase();
  if (lower !== word && spell.correct(lower)) return true;
  return false;
}

/**
 * Один suggest на нижний регистр. Повтор того же слова (и пара слово/lower)
 * берётся из кэша сессии, без второго прохода nspell.
 */
export function suggestCorrection(spell: SpellChecker, word: string): string | null {
  const lower = word.toLowerCase();
  if (suggestionByLower.has(lower)) return suggestionByLower.get(lower) ?? null;
  spellSuggestMisses += 1;
  const suggestion = spell.suggest(lower)[0] ?? null;
  suggestionByLower.set(lower, suggestion);
  return suggestion;
}
