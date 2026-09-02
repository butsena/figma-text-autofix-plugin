import { ungzip } from "pako";
import nspell from "nspell";
import {
  HUNSPELL_AFF_GZ_BASE64,
  HUNSPELL_DIC_GZ_BASE64,
  HUNSPELL_SOURCE,
} from "./hunspell-dict.generated";
import { getAllSpellExtraWords } from "./spell-word-list-store";

export type SpellChecker = ReturnType<typeof nspell>;

export { HUNSPELL_SOURCE };

let checker: SpellChecker | null = null;
let initPromise: Promise<SpellChecker> | null = null;
let extraWordsSignature = "";

function decodeGzipBase64(base64: string): string {
  const binary = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return ungzip(binary, { toText: true });
}

function buildChecker(extraWords: readonly string[]): SpellChecker {
  const aff = decodeGzipBase64(HUNSPELL_AFF_GZ_BASE64);
  const dic = decodeGzipBase64(HUNSPELL_DIC_GZ_BASE64);
  const spell = nspell(aff, dic);
  for (const word of extraWords) {
    spell.add(word.toLowerCase());
  }
  return spell;
}

function extraWordsKey(extraWords: readonly string[]): string {
  return extraWords.map((w) => w.toLowerCase()).join("\u0000");
}

/** Ленивая инициализация Hunspell (≈1–2 с при первом запуске). */
export async function ensureSpellCheckerReady(): Promise<SpellChecker> {
  const extraWords = getAllSpellExtraWords();
  const signature = extraWordsKey(extraWords);

  if (checker && signature === extraWordsSignature) {
    return checker;
  }

  if (initPromise && signature === extraWordsSignature) {
    return initPromise;
  }

  initPromise = Promise.resolve().then(() => {
    const started = Date.now();
    checker = buildChecker(extraWords);
    extraWordsSignature = signature;
    console.log(`[text-autofix] Hunspell ready (${HUNSPELL_SOURCE}) in ${Date.now() - started} ms`);
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
  extraWordsSignature = "";
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
