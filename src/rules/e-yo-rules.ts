import type { AutofixRule } from "../core/autofix-engine";
import { rule, rules } from "../core/rule-def";
import { CYRILLIC_LETTERS, cyrillicWholeWordPattern } from "./regex";
import { getYoCorrection } from "./yo-dictionary";

/**
 * Замена «е» на «ё» по словарю yobase (≈58k форм).
 * Омонимы (всё/все, нёбо/небо, замётка/заметка…) исключены через yo-unsure.txt.
 */
export function buildEYoRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-yo-dictionary",
      category: "yo_spelling",
      pattern: cyrillicWholeWordPattern(`[${CYRILLIC_LETTERS}]+`),
      replacement: (match, prefix, word) => {
        const right = getYoCorrection(word);
        if (!right) return match;
        return `${prefix}${right}`;
      },
      message: "Буква ё: заменить «е» на «ё» по орфографическому словарю.",
      priority: 78,
    }),
  ]);
}
