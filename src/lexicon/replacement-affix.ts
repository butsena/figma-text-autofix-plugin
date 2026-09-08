import { capitalizeLike } from "../shared/case";
import { CYRILLIC_LETTERS, CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END, escapeRegex } from "../rules/regex";

/** Перенести падежное/числовое окончание с найденного слова на каноническую основу. */
export function transferEnding(matchedWord: string, findStem: string, replaceStem: string): string {
  const lowerWord = matchedWord.toLowerCase();
  const lowerFind = findStem.toLowerCase();
  if (!lowerWord.startsWith(lowerFind)) {
    return capitalizeLike(matchedWord, replaceStem);
  }
  const ending = lowerWord.slice(lowerFind.length);
  return capitalizeLike(matchedWord, `${replaceStem.toLowerCase()}${ending}`);
}

/**
 * Найти самую длинную основу из списка, которой начинается слово (без учёта регистра).
 * Основы с пробелом/дефисом сравниваются как есть.
 */
export function longestStemMatch(word: string, stems: string[]): string | null {
  const lower = word.toLowerCase();
  let best: string | null = null;
  for (const stem of stems) {
    const s = stem.toLowerCase();
    if (lower.startsWith(s) && (best === null || s.length > best.length)) {
      best = stem;
    }
  }
  return best;
}

/** Паттерн: граница + (основа1|основа2)(окончание*) — без учёта регистра. */
export function affixStemPattern(stems: string[]): RegExp | null {
  const uniq = [...new Set(stems.map((s) => s.trim()).filter(Boolean))];
  if (uniq.length === 0) return null;
  const sorted = [...uniq].sort((a, b) => b.length - a.length);
  const alt = sorted.map(escapeRegex).join("|");
  return new RegExp(
    `${CYRILLIC_WORD_EDGE}((?:${alt})([${CYRILLIC_LETTERS}]*))${CYRILLIC_WORD_EDGE_END}`,
    "giu",
  );
}

/** Замена с переносом окончания на каноническую основу. */
export function affixReplacement(
  replaceStem: string,
  findStems: string[],
): (match: string, prefix: string, word: string, _ending: string) => string {
  const stems = findStems.map((s) => s.trim()).filter(Boolean);
  const canonical = replaceStem.toLowerCase();
  return (_match, prefix, word, _ending) => {
    const stem = longestStemMatch(word, stems);
    if (!stem) return `${prefix}${word}`;
    return `${prefix}${transferEnding(word, stem, canonical)}`;
  };
}
