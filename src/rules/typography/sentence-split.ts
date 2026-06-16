import { SENTENCE_END_PERIOD } from "./constants";

/** Граница предложения: точка (с оговорками), !, ?, … */
const SENTENCE_TERMINATOR = new RegExp(`${SENTENCE_END_PERIOD}|[!?…]`, "gu");

const LETTER = /[A-Za-zА-Яа-яЁё]/u;
const LIST_ITEM_LINE = /^(?:[•·*\-–—]\s|\d+[.)]\s)/u;

const HORIZONTAL_WS = String.raw`[ \t\u00A0\u202F]`;

/**
 * Неявная граница: слово из 4+ букв + пробел + новое предложение с заглавной.
 * Не после двоеточия (1: Главное). Не для коротких предлогов (в Москве).
 */
const IMPLICIT_SENTENCE_BOUNDARY = new RegExp(
  String.raw`(?<!:)${String.raw`(?<=[а-яёa-z]{4,}|[A-Za-z]{4,})`}${HORIZONTAL_WS}+(?=[А-ЯЁA-Z][а-яёa-zА-Яа-яЁёA-Za-z])`,
  "gu",
);

/** Точка перед буквой без пробела — вставить пробел (не example.com и не 1. пункт). */
const MISSING_SPACE_AFTER_PERIOD = new RegExp(
  String.raw`(?<!\d)\.(?![a-z0-9])(?=[A-Za-zА-Яа-яЁё])`,
  "gu",
);
const MISSING_SPACE_AFTER_OTHER_END = /([!?…])(?=[A-Za-zА-Яа-яЁё])/gu;

export function isListItemLine(line: string): boolean {
  return LIST_ITEM_LINE.test(line.trimStart());
}

export function isListOnlyLayer(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return false;
  return lines.every((line) => isListItemLine(line));
}

function collectFragmentStarts(text: string): number[] {
  const starts = new Set<number>([0]);

  SENTENCE_TERMINATOR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_TERMINATOR.exec(text)) !== null) {
    const afterTerminator = match.index + match[0].length;
    if (afterTerminator < text.length) {
      starts.add(afterTerminator);
    }
  }

  IMPLICIT_SENTENCE_BOUNDARY.lastIndex = 0;
  while ((match = IMPLICIT_SENTENCE_BOUNDARY.exec(text)) !== null) {
    starts.add(match.index);
  }

  return [...starts].sort((a, b) => a - b);
}

/** Разбивает текст на фрагменты-предложения (явные и неявные границы). */
export function splitIntoSentenceFragments(text: string): string[] {
  const starts = collectFragmentStarts(text);
  const fragments: string[] = [];

  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]!;
    const to = i + 1 < starts.length ? starts[i + 1]! : text.length;
    if (to > from) {
      fragments.push(text.slice(from, to));
    }
  }

  return fragments.filter((part) => part.length > 0);
}

function hasLetter(text: string): boolean {
  return LETTER.test(text);
}

function fragmentNeedsTerminalPeriod(fragment: string): boolean {
  const trimmedEnd = fragment.replace(/[ \t\u00A0\u202F]+$/u, "");
  if (!hasLetter(trimmedEnd)) return false;

  const lines = fragment.split(/\r?\n/);
  const lastNonEmpty = [...lines].reverse().find((line) => line.trim().length > 0);
  if (lastNonEmpty && isListItemLine(lastNonEmpty)) return false;

  const lastChar = trimmedEnd[trimmedEnd.length - 1];
  if (lastChar === "." || lastChar === "!" || lastChar === "?" || lastChar === "…") {
    return false;
  }

  return /[A-Za-zА-Яа-яЁё0-9»")\]]\s*$/u.test(trimmedEnd);
}

function insertTerminalPeriod(fragment: string): string {
  const trailingWs = fragment.match(/[ \t\u00A0\u202F\r\n]*$/u)?.[0] ?? "";
  const core = fragment.slice(0, fragment.length - trailingWs.length);
  return `${core}.${trailingWs}`;
}

export function normalizeSpaceAfterSentenceEnd(text: string): string {
  return text
    .replace(MISSING_SPACE_AFTER_PERIOD, ". ")
    .replace(MISSING_SPACE_AFTER_OTHER_END, "$1 ");
}

export function ensureSentenceTerminalPeriods(text: string): string {
  if (!hasLetter(text)) return text;
  if (isListOnlyLayer(text)) return text;

  let out = normalizeSpaceAfterSentenceEnd(text);
  const fragments = splitIntoSentenceFragments(out);
  const sentenceLike = fragments.filter((part) => hasLetter(part.trim()));

  if (sentenceLike.length <= 1) return out;

  out = fragments
    .map((part) => (fragmentNeedsTerminalPeriod(part) ? insertTerminalPeriod(part) : part))
    .join("");

  return out;
}
