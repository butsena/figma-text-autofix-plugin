/** Кириллица для границ «слова» без \\b. */
export const CYRILLIC_LETTERS = String.raw`А-Яа-яЁё`;

/** Латиница + кириллица (служебные слова в смешанном тексте). */
export const LATIN_CYRILLIC_LETTERS = String.raw`A-Za-zА-Яа-яЁё`;

export const CYRILLIC_WORD_EDGE = String.raw`(^|[^${CYRILLIC_LETTERS}])`;
export const CYRILLIC_WORD_EDGE_END = String.raw`(?=[^${CYRILLIC_LETTERS}]|$)`;

export const LATIN_CYRILLIC_WORD_EDGE = String.raw`(^|[^${LATIN_CYRILLIC_LETTERS}])`;
export const LATIN_CYRILLIC_WORD_EDGE_END = String.raw`(?=[^${LATIN_CYRILLIC_LETTERS}]|$)`;

/** Граница слова без захвата префикса — чтобы не сбрасывать стиль пробела при замене. */
export const LATIN_CYRILLIC_WORD_LOOKBEHIND = String.raw`(?<=^|[^${LATIN_CYRILLIC_LETTERS}])`;

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cyrillicWholeWordPattern(alternation: string, flags = "gu"): RegExp {
  return new RegExp(`${CYRILLIC_WORD_EDGE}(${alternation})${CYRILLIC_WORD_EDGE_END}`, flags);
}
