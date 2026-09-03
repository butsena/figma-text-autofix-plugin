import { CYRILLIC_LETTERS } from "../rules/regex";

export type CyrillicWordToken = {
  word: string;
  from: number;
  to: number;
};

const CYRILLIC_WORD = new RegExp(`[${CYRILLIC_LETTERS}]{2,}`, "gu");
const HAS_DIGIT = /\d/;

/** Извлекает кириллические слова длиной ≥ 2 символов. */
export function extractCyrillicWordTokens(text: string): CyrillicWordToken[] {
  const tokens: CyrillicWordToken[] = [];
  CYRILLIC_WORD.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CYRILLIC_WORD.exec(text)) !== null) {
    const word = match[0];
    const from = match.index;
    tokens.push({ word, from, to: from + word.length });
  }

  return tokens;
}

export function shouldSkipSpellToken(word: string): boolean {
  if (word.length < 2) return true;
  if (HAS_DIGIT.test(word)) return true;
  if (word === word.toUpperCase() && word !== word.toLowerCase() && word.length <= 5) {
    return true;
  }
  return false;
}

export function rangesOverlap(from: number, to: number, otherFrom: number, otherTo: number): boolean {
  return from < otherTo && to > otherFrom;
}
