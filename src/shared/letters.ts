import { LATIN_CYRILLIC_LETTERS } from "../rules/regex";

/** Одна буква латиницы или кириллицы (для проверки границ слова). */
export const LATIN_CYRILLIC_LETTER = new RegExp(`[${LATIN_CYRILLIC_LETTERS}]`, "u");
