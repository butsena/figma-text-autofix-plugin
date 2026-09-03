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
let initPromise: Promise<SpellChecker> | null = null;
let signature = "";

function buildChecker(): SpellChecker {
  const { aff, dic } = getHunspellDictionary();
  const spell = nspell(aff, dic);
  for (const word of getAllSpellExtraWords()) {
    spell.add(word.toLowerCase());
  }
  return spell;
}

function currentSignature(): string {
  const stats = getHunspellDictionaryLoadStats();
  const dict = getHunspellDictionary();
  const extra = getAllSpellExtraWords();
  return `${stats.fromRemote ? "remote" : "bundled"}:${dict.entryCount}:${extra.join("\u0000")}`;
}

/** Ленивая инициализация Hunspell (≈1–2 с при первом запуске). */
export async function ensureSpellCheckerReady(): Promise<SpellChecker> {
  const nextSignature = currentSignature();

  if (checker && signature === nextSignature) {
    return checker;
  }

  if (initPromise && signature === nextSignature) {
    return initPromise;
  }

  initPromise = Promise.resolve().then(() => {
    const started = Date.now();
    checker = buildChecker();
    signature = nextSignature;
    const stats = getHunspellDictionaryLoadStats();
    const source = stats.fromRemote ? "GitHub spell-dictionary" : HUNSPELL_SOURCE;
    console.log(
      `[text-autofix] Hunspell ready (${source}, ${stats.entryCount} entries) in ${Date.now() - started} ms`,
    );
    return checker;
  });

  return initPromise;
}

export function getSpellChecker(): SpellChecker | null {
  return checker;
}

export function resetSpellCheckerCache(): void {
  checker = null;
  initPromise = null;
  signature = "";
}

export function isKnownWord(spell: SpellChecker, word: string): boolean {
  if (!word) return true;
  if (spell.correct(word)) return true;
  const lower = word.toLowerCase();
  if (lower !== word && spell.correct(lower)) return true;
  return false;
}

export function suggestCorrection(spell: SpellChecker, word: string): string | null {
  const suggestions = spell.suggest(word);
  if (!suggestions.length) {
    const lowerSuggestions = spell.suggest(word.toLowerCase());
    if (!lowerSuggestions.length) return null;
    return lowerSuggestions[0] ?? null;
  }
  return suggestions[0] ?? null;
}
