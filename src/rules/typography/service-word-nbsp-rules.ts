import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { HORIZONTAL_SPACE, LINE_BREAK, NBSP } from "./constants";
import { serviceWordPattern } from "./ru-service-words";

export function buildServiceWordNbspRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-095-nbsp-after-short-words-strict",
      category: "typography",
      pattern: serviceWordPattern(`(?:${HORIZONTAL_SPACE}+)(?=\\S)`),
      replacement: (_match, prefix, word) => `${prefix}${word}${NBSP}`,
      message: "Типографика: неразрывный пробел после служебных слов.",
      priority: 52,
    }),
    rule({
      id: "cian-097-nbsp-after-service-words-before-line-end",
      category: "typography",
      pattern: serviceWordPattern(`(?:${HORIZONTAL_SPACE}{2,})(?=(?:${LINE_BREAK}|$))`),
      replacement: (_match, prefix, word) => `${prefix}${word}${NBSP}`,
      message:
        "Типографика: после служебного слова несколько пробелов/табов до конца строки или текста — один неразрывный пробел (перенос строки сохраняется).",
      priority: 53,
    }),
    rule({
      id: "cian-098-nbsp-after-service-words-newlines-before-text",
      category: "typography",
      pattern: serviceWordPattern(`((?:${LINE_BREAK})+)(?=\\S)`),
      replacement: (_match, prefix, word, newlines) => `${prefix}${word}${NBSP}${newlines}`,
      message:
        "Типографика: после служебного слова переводы строк перед текстом — вставить неразрывный пробел после слова, переносы сохранить.",
      priority: 55,
    }),
    rule({
      id: "cian-099-nbsp-after-service-words-trailing-newlines-at-eof",
      category: "typography",
      pattern: serviceWordPattern(`((?:(?:${HORIZONTAL_SPACE}*${LINE_BREAK})+(?:${HORIZONTAL_SPACE}*)?)+)$`, "gi"),
      replacement: (_match, prefix, word, tail) => {
        const keepFinalNl = /(?:\r?\n)\s*$/.test(tail);
        return keepFinalNl ? `${prefix}${word}${NBSP}\n` : `${prefix}${word}${NBSP}`;
      },
      message:
        "Типографика: после служебного слова в конце фрагмента остались переносы/пробелы — неразрывный пробел; один финальный перенос сохраняется при необходимости.",
      priority: 55,
    }),
    rule({
      id: "cian-101-nbsp-after-service-words-mixed-ws-before-text",
      category: "typography",
      pattern: serviceWordPattern(
        `((?:(?:${HORIZONTAL_SPACE}+${LINE_BREAK})+|(?:${LINE_BREAK}${HORIZONTAL_SPACE}+)+))(?=\\S)`,
      ),
      replacement: (_match, prefix, word, tail) => {
        const keepNl = /\r|\n/.test(tail) ? "\n" : "";
        return `${prefix}${word}${NBSP}${keepNl}`;
      },
      message:
        "Типографика: после служебного слова смесь пробелов и переводов строк перед текстом — неразрывный пробел и один перенос строки при необходимости.",
      priority: 54,
    }),
  ]);
}
