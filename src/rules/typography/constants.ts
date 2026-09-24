export const NBSP = "\u00A0";

/** Горизонтальные пробелы, включая NBSP, узкий NBSP и тонкие пробелы. */
export const HORIZONTAL_SPACE = String.raw`[ \t\f\v\u00A0\u202F\u2007\u2008\u2009\u200A\u205F]`;

/** Перевод строки: LF, CR, CRLF и Unicode-разделители (в Figma часто именно \\r). */
export const LINE_BREAK = String.raw`(?:\r\n|\n|\r|\u2028|\u2029)`;

/** Точка как конец предложения: не после цифры (1. пункт) и не перед продолжением домена (example.com). */
export const SENTENCE_END_PERIOD = String.raw`(?<!\d)\.(?![a-z0-9])`;

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
