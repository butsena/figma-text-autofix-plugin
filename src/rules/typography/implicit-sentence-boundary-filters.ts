import { matchesBoundaryExceptionAt } from "./boundary-exceptions-data";

const HORIZONTAL_WS = /[ \t\u00A0\u202F]/u;
const TITLE_CASE_WORD = /^[А-ЯЁA-Z][а-яёa-zА-Яа-яЁёA-Za-z\-']*/u;
const CYRILLIC_LOWER = /^[а-яё]{4,}$/u;
const LATIN_ONLY_WORD = /^[A-Za-z][A-Za-z\-']*$/u;

/** Слова перед названием: не граница предложения, а вставка имени/бренда. */
const NAME_MENTION_PREVIOUS_WORDS = new Set([
  "компании",
  "компанию",
  "компанией",
  "компания",
  "банке",
  "банка",
  "банком",
  "сервисе",
  "сервиса",
  "сервис",
  "приложении",
  "приложения",
  "приложение",
  "платформе",
  "платформы",
  "платформа",
  "бренд",
  "бренда",
  "бренде",
  "партнёр",
  "партнера",
  "партнёра",
  "партнер",
  "партнёром",
  "партнером",
  "отчёту",
  "отчёте",
  "отчёт",
  "отчету",
  "отчете",
  "отчет",
  "данным",
  "данные",
  "данных",
]);

function readWordAt(text: string, start: number): { word: string; end: number } | null {
  const match = text.slice(start).match(TITLE_CASE_WORD);
  if (!match) return null;
  return { word: match[0], end: start + match[0].length };
}

function isTitleCaseWord(word: string): boolean {
  if (word.length < 2) return false;
  const first = word[0]!;
  if (!/[А-ЯЁA-Z]/.test(first)) return false;
  const rest = word.slice(1);
  if (rest.length === 0) return false;
  return /^[а-яёa-z\-']+$/u.test(rest);
}

/** Подряд идущие слова в стиле Title Case (Knight Frank, New York). */
export function readTitleCaseRun(text: string, start: number): string[] {
  const words: string[] = [];
  let pos = start;

  while (pos < text.length) {
    if (words.length > 0) {
      const ws = text.slice(pos).match(/^[ \t\u00A0\u202F]+/u);
      if (!ws) break;
      pos += ws[0].length;
    }

    const next = readWordAt(text, pos);
    if (!next || !isTitleCaseWord(next.word)) break;
    words.push(next.word);
    pos = next.end;
  }

  return words;
}

function getWordBeforeIndex(text: string, index: number): string | null {
  let end = index;
  while (end > 0 && HORIZONTAL_WS.test(text[end - 1]!)) {
    end--;
  }
  if (end === 0) return null;

  let start = end - 1;
  while (start >= 0 && /[а-яёa-zА-Яа-яЁёA-Za-z\-']/u.test(text[start]!)) {
    start--;
  }
  const word = text.slice(start + 1, end);
  return word.length > 0 ? word : null;
}

function getPreviousWord(text: string, wsStart: number): string | null {
  return getWordBeforeIndex(text, wsStart);
}

function isContinuationOfTitleCaseRun(text: string, capStart: number): boolean {
  const prevWord = getWordBeforeIndex(text, capStart);
  return Boolean(prevWord && isTitleCaseWord(prevWord));
}

function isInsideGuillemets(text: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    const ch = text[i];
    if (ch === "«") depth++;
    else if (ch === "»") depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

function isInsideDoubleQuotes(text: string, index: number): boolean {
  let inQuotes = false;
  for (let i = 0; i < index; i++) {
    if (text[i] === '"') inQuotes = !inQuotes;
  }
  return inQuotes;
}

function capitalWordStart(text: string, wsStart: number): number | null {
  const ws = text.slice(wsStart).match(/^[ \t\u00A0\u202F]+/u);
  if (!ws) return null;
  return wsStart + ws[0].length;
}

/**
 * Проверяет кандидат на неявную границу предложения (индекс начала пробела перед заглавным словом).
 * Возвращает false для упоминаний названий и брендов.
 */
export function isValidImplicitSentenceBoundary(text: string, wsStart: number): boolean {
  const capStart = capitalWordStart(text, wsStart);
  if (capStart === null) return false;

  if (isInsideGuillemets(text, capStart) || isInsideDoubleQuotes(text, capStart)) {
    return false;
  }

  if (isContinuationOfTitleCaseRun(text, capStart)) {
    return false;
  }

  const titleRun = readTitleCaseRun(text, capStart);
  if (titleRun.length >= 2) return false;

  const firstWord = titleRun[0] ?? readWordAt(text, capStart)?.word;
  if (!firstWord) return false;

  const prevWord = getPreviousWord(text, wsStart);
  if (prevWord && NAME_MENTION_PREVIOUS_WORDS.has(prevWord.toLowerCase())) {
    return false;
  }

  if (LATIN_ONLY_WORD.test(firstWord) && prevWord && CYRILLIC_LOWER.test(prevWord)) {
    return false;
  }

  if (matchesBoundaryExceptionAt(text, capStart)) {
    return false;
  }

  return true;
}
