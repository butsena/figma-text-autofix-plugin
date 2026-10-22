import { getBoundaryExceptions } from "../../lexicon/boundary-exceptions-store";
import { LATIN_CYRILLIC_LETTER } from "../../shared/letters";

const CYRILLIC_LETTER = /[а-яё]/u;

/**
 * Падеж и число после словарной формы.
 * Хвост должен совпасть с окончанием целиком: «Циане» да, «цианид» и «сбережения» нет.
 * Чередования вроде «Тверь» → «Твери» не покрываются.
 */
const INFLECTION_ENDINGS = [
  "ами",
  "ями",
  "ах",
  "ях",
  "ов",
  "ев",
  "ёв",
  "ом",
  "ем",
  "ём",
  "ой",
  "ей",
  "ёй",
  "ам",
  "ям",
  "а",
  "я",
  "у",
  "ю",
  "е",
  "и",
  "ы",
] as const;

function isWordBoundary(char: string | undefined): boolean {
  return char === undefined || !LATIN_CYRILLIC_LETTER.test(char);
}

function endsWithCyrillic(phraseLower: string): boolean {
  const last = phraseLower.at(-1);
  return last !== undefined && CYRILLIC_LETTER.test(last);
}

function hasInflectionEnding(restLower: string): boolean {
  for (const ending of INFLECTION_ENDINGS) {
    if (!restLower.startsWith(ending)) continue;
    if (isWordBoundary(restLower[ending.length])) return true;
  }
  return false;
}

export function matchesBoundaryExceptionAt(
  text: string,
  index: number,
  phrases: readonly string[] = getBoundaryExceptions(),
): boolean {
  const tailLower = text.slice(index).toLowerCase();
  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    if (!tailLower.startsWith(phraseLower)) continue;
    const restLower = tailLower.slice(phraseLower.length);
    if (isWordBoundary(restLower[0])) return true;
    if (endsWithCyrillic(phraseLower) && hasInflectionEnding(restLower)) return true;
  }
  return false;
}
