/** Латиница + кириллица (границы слова в смешанном тексте). */
export const LATIN_CYRILLIC_LETTERS = String.raw`A-Za-zА-Яа-яЁё`;

/** Одна буква латиницы или кириллицы (для проверки границ слова). */
export const LATIN_CYRILLIC_LETTER = new RegExp(`[${LATIN_CYRILLIC_LETTERS}]`, "u");
