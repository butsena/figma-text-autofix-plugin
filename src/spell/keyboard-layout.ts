/** QWERTY (EN) → ЙЦУКЕН (RU): опечатки «забыли переключить раскладку». */

const EN_TO_RU_LOWER: Record<string, string> = {
  q: "й",
  w: "ц",
  e: "у",
  r: "к",
  t: "е",
  y: "н",
  u: "г",
  i: "ш",
  o: "щ",
  p: "з",
  "[": "х",
  "]": "ъ",
  a: "ф",
  s: "ы",
  d: "в",
  f: "а",
  g: "п",
  h: "р",
  j: "о",
  k: "л",
  l: "д",
  ";": "ж",
  "'": "э",
  "’": "э",
  "‘": "э",
  z: "я",
  x: "ч",
  c: "с",
  v: "м",
  b: "и",
  n: "т",
  m: "ь",
  ",": "б",
  ".": "ю",
  "`": "ё",
};

/** Латиница + клавиши, которые на русской раскладке дают буквы. */
const LATIN_LAYOUT_TOKEN = /[A-Za-z\[\]`;',.’‘]+/gu;

const EN_VOWELS = /[aeiou]/i;
const CYRILLIC_LETTER = /[а-яё]/i;
const HAS_DIGIT = /\d/;

/**
 * Частые латинские токены в UI/копирайте, которые не надо считать раскладкой.
 * Полный EN-словарь не нужен — только короткий allowlist.
 */
const LATIN_ALLOWLIST = new Set(
  [
    "id",
    "ui",
    "ux",
    "api",
    "sdk",
    "app",
    "web",
    "www",
    "url",
    "http",
    "https",
    "html",
    "css",
    "scss",
    "xml",
    "json",
    "pdf",
    "csv",
    "sms",
    "pin",
    "otp",
    "faq",
    "ceo",
    "cta",
    "kpi",
    "ios",
    "android",
    "figma",
    "google",
    "apple",
    "email",
    "online",
    "offline",
    "wifi",
    "cian",
    "ok",
    "vs",
    "pro",
    "max",
    "mini",
    "demo",
    "beta",
    "test",
  ].map((w) => w.toLowerCase()),
);

export type LatinLayoutToken = {
  word: string;
  from: number;
  to: number;
};

export type MixedScriptToken = {
  word: string;
  from: number;
  to: number;
};

const LETTER_RUN = /[A-Za-zА-Яа-яЁё]+/gu;

/** Конвертирует только латинские символы; кириллицу не трогает. */
export function convertLatinCharsToRuLayout(input: string): string {
  let out = "";
  for (const ch of input) {
    if (/[A-Za-z]/.test(ch)) {
      out += convertEnLayoutToRu(ch);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Слово смешало латиницу и кириллицу (gдоказываем, пokаз…).
 * Без EN-словаря: раскладка латинских букв или отбрасывание латиницы.
 */
export function suggestMixedScriptRu(
  word: string,
  isKnown: (candidate: string) => boolean,
): string | null {
  if (!/[A-Za-z]/.test(word) || !/[А-Яа-яЁё]/.test(word)) return null;

  const converted = convertLatinCharsToRuLayout(word);
  if (converted !== word && isKnown(converted)) return converted;

  const strippedCyr = word.replace(/[A-Za-z]+/g, "");
  if (strippedCyr.length >= 3 && isKnown(strippedCyr)) return strippedCyr;

  const latinOnly = word.replace(/[^A-Za-z]/g, "");
  if (latinOnly.length >= 3) {
    const fromLatin = convertEnLayoutToRu(latinOnly);
    if (fromLatin !== latinOnly && isKnown(fromLatin)) return fromLatin;
  }

  return null;
}

export function extractMixedScriptTokens(text: string): MixedScriptToken[] {
  const tokens: MixedScriptToken[] = [];
  LETTER_RUN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LETTER_RUN.exec(text)) !== null) {
    const word = match[0];
    if (!/[A-Za-z]/.test(word) || !/[А-Яа-яЁё]/.test(word)) continue;
    tokens.push({ word, from: match.index, to: match.index + word.length });
  }
  return tokens;
}

/** После «1. » / «2) » предложение в пункте — с заглавной. */
export function casingForSuggestion(text: string, from: number, suggestion: string): string {
  if (!suggestion) return suggestion;
  if (/\d+[.)\uFF0E][ \t\u00A0\u202F\u2007-\u200A\u205F]*$/.test(text.slice(0, from))) {
    const first = suggestion.charAt(0);
    const upper = first.toLowerCase() === "ё" ? "Ё" : first.toUpperCase();
    return upper + suggestion.slice(1);
  }
  return suggestion;
}

export function convertEnLayoutToRu(input: string): string {
  let out = "";
  for (const ch of input) {
    const lower = ch.toLowerCase();
    const mapped = EN_TO_RU_LOWER[lower];
    if (!mapped) {
      out += ch;
      continue;
    }
    out += ch === lower ? mapped : mapped.toUpperCase();
  }
  return out;
}

export function extractLatinLayoutTokens(text: string): LatinLayoutToken[] {
  const tokens: LatinLayoutToken[] = [];
  LATIN_LAYOUT_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LATIN_LAYOUT_TOKEN.exec(text)) !== null) {
    const word = match[0];
    if (!/[A-Za-z]/.test(word)) continue;
    tokens.push({ word, from: match.index, to: match.index + word.length });
  }
  return tokens;
}

function letterCount(word: string): number {
  let n = 0;
  for (const ch of word) {
    if (/[A-Za-z]/.test(ch)) n += 1;
  }
  return n;
}

export function shouldSkipLatinLayoutToken(word: string): boolean {
  if (letterCount(word) < 3) return true;
  if (HAS_DIGIT.test(word)) return true;
  if (LATIN_ALLOWLIST.has(word.toLowerCase())) return true;
  if (word === word.toUpperCase() && word !== word.toLowerCase() && letterCount(word) <= 5) {
    return true;
  }
  return false;
}

export function textHasCyrillic(text: string): boolean {
  return CYRILLIC_LETTER.test(text);
}

/** Латиница без английских гласных — типичный след русской печати в EN-раскладке. */
export function looksLikeRuTypedInEnLayout(word: string): boolean {
  if (letterCount(word) < 4) return false;
  const lettersOnly = word.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length < 4) return false;
  return !EN_VOWELS.test(lettersOnly);
}

export function isLikelyUrlOrEmailContext(text: string, from: number, to: number): boolean {
  const before = text.slice(Math.max(0, from - 1), from);
  const after = text.slice(to, Math.min(text.length, to + 1));
  if (before === "@" || after === "@") return true;
  const window = text.slice(Math.max(0, from - 8), Math.min(text.length, to + 8)).toLowerCase();
  if (window.includes("://") || window.includes("www.")) return true;
  return false;
}
