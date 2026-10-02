function sourceLetters(source: string): string {
  return source.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
}

/** Привести регистр target к регистру source (слово целиком / первая буква / ALL CAPS). */
export function capitalizeLike(source: string, target: string): string {
  const letters = sourceLetters(source);
  if (!letters) return target;
  if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
    return target.toUpperCase();
  }
  if (letters.charAt(0) === letters.charAt(0).toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target;
}

/**
 * Подстановка из поля орфографии: регистр как у исходного слова.
 * Ведущий пробел подсказки не срезается trim — он отделяет «,elbnt» от предыдущего слова.
 */
export function replacementFromSpellInput(before: string, suggested: string, typed: string): string {
  const cased = capitalizeLike(before, typed.trim());
  const leading = /^\s+/.exec(suggested)?.[0] ?? "";
  if (!leading || cased.startsWith(leading)) return cased;
  return leading + cased.replace(/^\s+/, "");
}

/** Заменить «ё/Ё» на «е/Е», не трогая остальные буквы. */
export function foldYoToYe(word: string): string {
  return word.replace(/ё/g, "е").replace(/Ё/g, "Е");
}
