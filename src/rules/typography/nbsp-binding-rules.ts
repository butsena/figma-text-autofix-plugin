import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { NBSP } from "./constants";

/** Месяцы в родительном падеже после числа: «12 апреля». */
const RU_MONTH_GENITIVE =
  "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря";

const WS = String.raw`[ \t\u00A0\u202F]+`;

export function buildNbspBindingRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-122-nbsp-day-month",
      category: "typography",
      pattern: new RegExp(
        `(\\d{1,2})${WS}(${RU_MONTH_GENITIVE})(?=${WS}\\d{4}|[\\s,.;:!?»"')\\]]|$)`,
        "gi",
      ),
      replacement: (_m, day, month) => `${day}${NBSP}${month}`,
      message: "Типографика: неразрывный пробел между числом и названием месяца.",
      priority: 53,
    }),
    rule({
      id: "cian-123-nbsp-month-year",
      category: "typography",
      pattern: new RegExp(`(${RU_MONTH_GENITIVE})${WS}(\\d{4})(?=[^\\d]|$)`, "gi"),
      replacement: (_m, month, year) => `${month}${NBSP}${year}`,
      message: "Типографика: неразрывный пробел между месяцем и годом.",
      priority: 53,
    }),
    rule({
      id: "cian-124-nbsp-year-god",
      category: "typography",
      pattern: /(\d{4})[ \t\u00A0\u202F]+(года|г\.)(?=[\s,.;:!?»"')\]]|$)/gi,
      replacement: (_m, year, tail) => `${year}${NBSP}${tail}`,
      message: "Типографика: неразрывный пробел между годом и «г.» / «года».",
      priority: 53,
    }),
    rule({
      id: "cian-125-nbsp-city-prefix",
      category: "typography",
      // г. Москва, ул. Ленина — только если после точки идёт заглавная буква
      pattern: /(^|[^\p{L}\d])(г|ул|пр|пер|им)\.[ \t\u00A0\u202F]+(?=[\p{Lu}])/gu,
      replacement: (_m, prefix, abbr) => `${prefix}${abbr}.${NBSP}`,
      message: "Типографика: неразрывный пробел после сокращения (г., ул., пр., пер., им.).",
      priority: 53,
    }),
    rule({
      id: "cian-126-nbsp-td-te",
      category: "typography",
      pattern: /(?<![\p{L}\d])т\.[ \t\u00A0\u202F]*([де])\./giu,
      replacement: (_m, letter) => `т.${NBSP}${letter}.`,
      message: "Типографика: неразрывный пробел в сокращениях «т. д.» / «т. е.».",
      priority: 53,
    }),
    rule({
      id: "cian-127-nbsp-itc",
      category: "typography",
      pattern: /(?<![\p{L}\d])и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*п\./giu,
      replacement: `и${NBSP}т.${NBSP}п.`,
      message: "Типографика: неразрывные пробелы в «и т. п.».",
      priority: 53,
    }),
    rule({
      id: "cian-128-nbsp-tk-tch",
      category: "typography",
      pattern: /(?<![\p{L}\d])т\.[ \t\u00A0\u202F]*([кч])\./giu,
      replacement: (_m, letter) => `т.${NBSP}${letter}.`,
      message: "Типографика: неразрывный пробел в сокращениях «т. к.» / «т. ч.».",
      priority: 53,
    }),
  ]);
}
