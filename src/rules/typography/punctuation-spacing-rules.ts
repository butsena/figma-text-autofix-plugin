import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";

/**
 * Знаки, перед которыми в русской типографике не ставят пробел
 * (закрывающие / завершающие; открывающие « ( [ не трогаем).
 */
const SPACE_BEFORE_PUNCT = /[ \t\u00A0\u202F]+(?=[,.;:!?…%»›)\]])/g;

export function buildPunctuationSpacingRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-129-remove-space-before-punctuation",
      category: "typography",
      pattern: SPACE_BEFORE_PUNCT,
      replacement: "",
      message:
        "Типографика: убрать лишние пробелы перед знаком препинания (, . ; : ! ? … % » ) ] и т.п.).",
      priority: 57,
    }),
    rule({
      id: "cian-131-collapse-double-punctuation",
      category: "typography",
      // ,,  !!  ??  ::  ;;  и т.п. (точка — отдельно, чтобы не трогать «...» → «…»)
      pattern: /([,;:!?…])(?:\1)+/g,
      replacement: "$1",
      message: "Типографика: двойной знак препинания заменить на одинарный.",
      priority: 55,
    }),
    rule({
      id: "cian-132-collapse-double-period",
      category: "typography",
      // «..» → «.»; «...» обрабатывает cian-118-ellipsis-three-dots
      pattern: /\.{2}(?!\.)/g,
      replacement: ".",
      message: "Типографика: двойная точка заменить на одну.",
      priority: 54,
    }),
    rule({
      id: "cian-133-collapse-double-emdash",
      category: "typography",
      pattern: /—{2,}/g,
      replacement: "—",
      message: "Типографика: двойное длинное тире заменить на одно.",
      priority: 55,
    }),
    rule({
      id: "cian-134-collapse-double-ellipsis-char",
      category: "typography",
      pattern: /…{2,}/g,
      replacement: "…",
      message: "Типографика: двойное многоточие заменить на одно.",
      priority: 55,
    }),
  ]);
}
