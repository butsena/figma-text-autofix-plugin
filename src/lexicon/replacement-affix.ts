import { capitalizeLike } from "../shared/case";
import { CYRILLIC_LETTERS, CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END, escapeRegex } from "../rules/regex";

/** В макетах вместо ASCII '-' часто стоят типографские дефисы/тире. */
const JOIN_DASH_CLASS = String.raw`[\-\u00AD\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]`;
const JOIN_SPACE_CLASS = String.raw`[ \t\u00A0\u202F]`;

/** Свести типографские дефисы и неразрывные пробелы к ASCII — для сравнения основ. */
export function normalizeJoinSeparators(s: string): string {
  return s
    .replace(/[\u00AD\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g, "-")
    .replace(/[\t\u00A0\u202F]/g, " ");
}

function stemToRegex(stem: string): string {
  let out = "";
  for (const ch of stem) {
    if (ch === "-") out += JOIN_DASH_CLASS;
    else if (ch === " ") out += JOIN_SPACE_CLASS;
    else out += escapeRegex(ch);
  }
  return out;
}

/** Перенести падежное/числовое окончание с найденного слова на каноническую основу. */
export function transferEnding(matchedWord: string, findStem: string, replaceStem: string): string {
  const lowerWord = normalizeJoinSeparators(matchedWord.toLowerCase());
  const lowerFind = normalizeJoinSeparators(findStem.toLowerCase());
  if (!lowerWord.startsWith(lowerFind)) {
    return capitalizeLike(matchedWord, replaceStem);
  }
  const ending = lowerWord.slice(lowerFind.length);
  return capitalizeLike(matchedWord, `${replaceStem.toLowerCase()}${ending}`);
}

/**
 * Найти самую длинную основу из списка, которой начинается слово (без учёта регистра).
 * Основы с пробелом/дефисом сравниваются как есть; типографские дефисы приравниваются к ASCII.
 */
export function longestStemMatch(word: string, stems: string[]): string | null {
  const lower = normalizeJoinSeparators(word.toLowerCase());
  let best: string | null = null;
  for (const stem of stems) {
    const s = normalizeJoinSeparators(stem.toLowerCase());
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
  const alt = sorted.map(stemToRegex).join("|");
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
