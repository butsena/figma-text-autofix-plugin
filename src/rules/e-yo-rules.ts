import type { AutofixRule } from "../core/autofix-engine";
import { rule, rules } from "../core/rule-def";
import { MSG_ORTHOGRAPHY_YO } from "./rule-messages";
import { CYRILLIC_LETTERS, cyrillicWholeWordPattern } from "./regex";
import { getYoCorrection } from "./yo-dictionary";

/**
 * Замена «е» на «ё» по курируемому списку для IT и недвижимости.
 */
export function buildEYoRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-yo-dictionary",
      category: "yo_spelling",
      pattern: cyrillicWholeWordPattern(`[${CYRILLIC_LETTERS}]*[еЕ][${CYRILLIC_LETTERS}]*`),
      replacement: (match, prefix, word) => {
        const right = getYoCorrection(word);
        if (!right) return match;
        return `${prefix}${right}`;
      },
      message: MSG_ORTHOGRAPHY_YO,
      priority: 78,
    }),
  ]);
}
