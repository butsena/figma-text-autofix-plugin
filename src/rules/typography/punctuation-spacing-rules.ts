import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import {
  MSG_TYPO_COLLAPSE_DOUBLE_PUNCT,
  MSG_TYPO_REMOVE_SPACE_BEFORE_PUNCT,
} from "../rule-messages";

/**
 * Знаки, перед которыми в русской типографике не ставят пробел
 * (закрывающие / завершающие; открывающие « ( [ не трогаем).
 */
/**
 * Пробел перед знаком убираем.
 * «,» «.» «;» сразу перед латиницей — это буква раскладки («,elbnt» = «будите»), не знак.
 */
const SPACE_BEFORE_PUNCT =
  /[ \t\u00A0\u202F]+(?=(?:[,.;](?![A-Za-z])|[:!?…%»›)\]]))/g;

export function buildPunctuationSpacingRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-129-remove-space-before-punctuation",
      category: "typography",
      pattern: SPACE_BEFORE_PUNCT,
      replacement: "",
      message: MSG_TYPO_REMOVE_SPACE_BEFORE_PUNCT,
      priority: 57,
    }),
    rule({
      id: "cian-131-collapse-double-punctuation",
      category: "typography",
      // ,,  !!  ??  ::  ;;  и т.п. (точка — отдельно, чтобы не трогать «...» → «…»)
      pattern: /([,;:!?…])(?:\1)+/g,
      replacement: "$1",
      message: MSG_TYPO_COLLAPSE_DOUBLE_PUNCT,
      priority: 55,
    }),
    rule({
      id: "cian-132-collapse-double-period",
      category: "typography",
      // «..» → «.»; «...» обрабатывает cian-118-ellipsis-three-dots
      pattern: /\.{2}(?!\.)/g,
      replacement: ".",
      message: MSG_TYPO_COLLAPSE_DOUBLE_PUNCT,
      priority: 54,
    }),
    rule({
      id: "cian-133-collapse-double-emdash",
      category: "typography",
      pattern: /—{2,}/g,
      replacement: "—",
      message: MSG_TYPO_COLLAPSE_DOUBLE_PUNCT,
      priority: 55,
    }),
    rule({
      id: "cian-134-collapse-double-ellipsis-char",
      category: "typography",
      pattern: /…{2,}/g,
      replacement: "…",
      message: MSG_TYPO_COLLAPSE_DOUBLE_PUNCT,
      priority: 55,
    }),
  ]);
}
