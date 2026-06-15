export const NBSP = "\u00A0";

/** Горизонтальные пробелы, включая NBSP и узкий NBSP. */
export const HORIZONTAL_SPACE = String.raw`[ \t\f\v\u00A0\u202F]`;

export const LINE_BREAK = String.raw`\r?\n`;

/** Пустые переводы строк: в начале/конце или два и более подряд (строка без текста). */
export const EMPTY_LINE_BREAKS_PATTERN = new RegExp(
  `(?:^(?:${LINE_BREAK}${HORIZONTAL_SPACE}*)+|(?:${LINE_BREAK}${HORIZONTAL_SPACE}*){2,}|(?:${LINE_BREAK}${HORIZONTAL_SPACE}*)+$)`,
  "g",
);
