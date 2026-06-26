export const NBSP = "\u00A0";

/** Горизонтальные пробелы, включая NBSP и узкий NBSP. */
export const HORIZONTAL_SPACE = String.raw`[ \t\f\v\u00A0\u202F]`;

export const LINE_BREAK = String.raw`\r?\n`;

/** Точка как конец предложения: не после цифры (1. пункт) и не перед продолжением домена (example.com). */
export const SENTENCE_END_PERIOD = String.raw`(?<!\d)\.(?![a-z0-9])`;

/** Начало предложения: старт текста или после .!?… (без переноса строки). */
export const SENTENCE_START_LOOKBEHIND = String.raw`(?<=^|${SENTENCE_END_PERIOD}|[!?…]${HORIZONTAL_SPACE}*)`;

/** Пустые переводы строк: в начале/конце или два и более подряд (строка без текста). */
export const LEADING_LINE_BREAKS_PATTERN = new RegExp(
  `^(?:${LINE_BREAK}${HORIZONTAL_SPACE}*)+`,
  "g",
);

export const TRAILING_LINE_BREAKS_PATTERN = new RegExp(
  `(?:${LINE_BREAK}${HORIZONTAL_SPACE}*)+$`,
  "g",
);

/** Три и более переноса подряд между строками с текстом — схлопнуть до абзацного разрыва. */
export const EXCESS_LINE_BREAKS_PATTERN = new RegExp(
  `(?<=[^\r\n])(?:${LINE_BREAK}${HORIZONTAL_SPACE}*){3,}(?=[^\r\n])`,
  "g",
);

/** @deprecated */
export const MULTIPLE_LINE_BREAKS_PATTERN = EXCESS_LINE_BREAKS_PATTERN;

/** @deprecated Используйте отдельные LEADING / TRAILING / MULTIPLE паттерны. */
export const EMPTY_LINE_BREAKS_PATTERN = new RegExp(
  `(?:^(?:${LINE_BREAK}${HORIZONTAL_SPACE}*)+|(?:${LINE_BREAK}${HORIZONTAL_SPACE}*){2,}|(?:${LINE_BREAK}${HORIZONTAL_SPACE}*)+$)`,
  "g",
);
