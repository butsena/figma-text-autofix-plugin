import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { LATIN_CYRILLIC_LETTERS } from "../regex";
import { HORIZONTAL_SPACE, NBSP } from "./constants";

export function buildEmdashRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-117-normalize-spaced-dashes-to-emdash",
      category: "punctuation_typography",
      pattern: new RegExp(
        `(?<!\\d)${HORIZONTAL_SPACE}+(?:-|–|−)${HORIZONTAL_SPACE}+(?!\\d)`,
        "g",
      ),
      replacement: `${NBSP}— `,
      message: "Типографика: короткое тире/минус с пробелами заменяем на длинное тире.",
      priority: 56,
    }),
    rule({
      id: "cian-115-nbsp-before-emdash-after-word",
      category: "punctuation_typography",
      pattern: new RegExp(`([${LATIN_CYRILLIC_LETTERS}0-9])${HORIZONTAL_SPACE}+—`, "g"),
      replacement: (_match, left) => `${left}${NBSP}—`,
      message: "Типографика: перед длинным тире после слова ставить неразрывный пробел.",
      priority: 54,
    }),
    rule({
      id: "cian-116-nbsp-after-emdash-before-word",
      category: "punctuation_typography",
      pattern: new RegExp(`—${HORIZONTAL_SPACE}+([${LATIN_CYRILLIC_LETTERS}0-9])`, "g"),
      replacement: (_match, right) => `— ${right}`,
      message: "Типографика: после длинного тире перед словом ставить обычный пробел.",
      priority: 54,
    }),
  ]);
}
