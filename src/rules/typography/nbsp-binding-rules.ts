import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import {
  MSG_TYPO_NBSP_ABBREVIATION,
  MSG_TYPO_NBSP_DATE_ADDRESS,
} from "../rule-messages";
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
      message: MSG_TYPO_NBSP_DATE_ADDRESS,
      priority: 53,
    }),
    rule({
      id: "cian-123-nbsp-month-year",
      category: "typography",
      pattern: new RegExp(`(${RU_MONTH_GENITIVE})${WS}(\\d{4})(?=[^\\d]|$)`, "gi"),
      replacement: (_m, month, year) => `${month}${NBSP}${year}`,
      message: MSG_TYPO_NBSP_DATE_ADDRESS,
      priority: 53,
    }),
    rule({
      id: "cian-124-nbsp-year-god",
      category: "typography",
      pattern: /(\d{4})[ \t\u00A0\u202F]+(года|г\.)(?=[\s,.;:!?»"')\]]|$)/gi,
      replacement: (_m, year, tail) => `${year}${NBSP}${tail}`,
      message: MSG_TYPO_NBSP_DATE_ADDRESS,
      priority: 53,
    }),
    rule({
      id: "cian-125-nbsp-city-prefix",
      category: "typography",
      // г. Москва, ул. Ленина — только если после точки идёт заглавная буква
      pattern: /(^|[^\p{L}\d])(г|ул|пр|пер|им)\.[ \t\u00A0\u202F]+(?=[\p{Lu}])/gu,
      replacement: (_m, prefix, abbr) => `${prefix}${abbr}.${NBSP}`,
      message: MSG_TYPO_NBSP_DATE_ADDRESS,
      priority: 53,
    }),
    rule({
      id: "cian-126-nbsp-td-te",
      category: "typography",
      pattern: /(?<![\p{L}\d])т\.[ \t\u00A0\u202F]*([де])\./giu,
      replacement: (_m, letter) => `т.${NBSP}${letter}.`,
      message: MSG_TYPO_NBSP_ABBREVIATION,
      priority: 53,
    }),
    rule({
      id: "cian-127-nbsp-itc",
      category: "typography",
      pattern: /(?<![\p{L}\d])и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*п\./giu,
      replacement: `и${NBSP}т.${NBSP}п.`,
      message: MSG_TYPO_NBSP_ABBREVIATION,
      priority: 53,
    }),
    rule({
      id: "cian-128-nbsp-tk-tch",
      category: "typography",
      pattern: /(?<![\p{L}\d])т\.[ \t\u00A0\u202F]*([кч])\./giu,
      replacement: (_m, letter) => `т.${NBSP}${letter}.`,
      message: MSG_TYPO_NBSP_ABBREVIATION,
      priority: 53,
    }),
  ]);
}
