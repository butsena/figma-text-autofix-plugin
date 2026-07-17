import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import {
  MSG_TYPO_ELLIPSIS,
  MSG_TYPO_NBSP_BEFORE_UNIT,
  MSG_TYPO_NBSP_NUMBER,
  MSG_TYPO_NBSP_PERCENT,
  MSG_TYPO_REMOVE_EXTRA_LINE_BREAK,
  MSG_TYPO_REMOVE_EXTRA_SPACE,
} from "../rule-messages";
import {
  EXCESS_LINE_BREAKS_PATTERN,
  LEADING_LINE_BREAKS_PATTERN,
  NBSP,
  TRAILING_LINE_BREAKS_PATTERN,
} from "./constants";
import { buildEmdashRules } from "./emdash-rules";
import { buildPhoneRules } from "./phone-rules";
import { buildQuotesRules } from "./quotes-rules";

/** Число + единица: NBSP между ними; для ₽/руб./млн/тыс — даже если пробела нет. */
const NUMBER_UNIT_PATTERN =
  /(\d+(?:[ \u00A0\u202F]\d{3})*(?:[.,]\d+)?)([ \u00A0\u202F]*)((?:°C|°F|мм|см|км|кг|мг|мл|мин|млн|тыс|м²|м³|руб\.?|₽|р\.?|ч|с|м|л|г))(?=[^\p{L}\p{N}]|$)/giu;

const GLUED_UNIT = /^(?:руб\.?|₽|р\.?|млн|тыс)$/iu;

function nbspBeforeUnit(num: string, sep: string, unit: string, matched: string): string {
  if (sep.length > 0) return `${num}${NBSP}${unit}`;
  if (GLUED_UNIT.test(unit)) return `${num}${NBSP}${unit}`;
  return matched;
}

export function buildGeneralTypographyRules(): AutofixRule[] {
  return rules([
    ...buildPhoneRules(),
    rule({
      id: "cian-110-nbsp-number-unit",
      category: "typography",
      pattern: NUMBER_UNIT_PATTERN,
      replacement: (match, num, sep, unit) => nbspBeforeUnit(num, sep, unit, match),
      message: MSG_TYPO_NBSP_BEFORE_UNIT,
      priority: 53,
    }),
    rule({
      id: "cian-113-percent-without-space",
      category: "numeric_formatting",
      pattern: /(\d+)\s+%/g,
      replacement: (_match, num) => `${num}%`,
      message: MSG_TYPO_NBSP_PERCENT,
      priority: 54,
    }),
    rule({
      id: "cian-114-collapse-double-spaces",
      category: "typography",
      pattern: / {2,}/g,
      replacement: " ",
      message: MSG_TYPO_REMOVE_EXTRA_SPACE,
      priority: 54,
    }),
    rule({
      id: "cian-121-remove-leading-line-breaks",
      category: "typography",
      pattern: LEADING_LINE_BREAKS_PATTERN,
      replacement: "",
      message: MSG_TYPO_REMOVE_EXTRA_LINE_BREAK,
      priority: 52,
    }),
    rule({
      id: "cian-121-remove-trailing-line-breaks",
      category: "typography",
      pattern: TRAILING_LINE_BREAKS_PATTERN,
      replacement: "",
      message: MSG_TYPO_REMOVE_EXTRA_LINE_BREAK,
      priority: 52,
    }),
    rule({
      id: "cian-121-collapse-excess-line-breaks",
      category: "typography",
      pattern: EXCESS_LINE_BREAKS_PATTERN,
      replacement: "\n\n",
      message: MSG_TYPO_REMOVE_EXTRA_LINE_BREAK,
      priority: 52,
    }),
    ...buildEmdashRules(),
    rule({
      id: "cian-111-nbsp-after-numero-sign",
      category: "typography",
      pattern: /(№)\s+(\d+)/g,
      replacement: (_match, sign, num) => `${sign}${NBSP}${num}`,
      message: MSG_TYPO_NBSP_NUMBER,
      priority: 53,
    }),
    rule({
      id: "cian-112-nbsp-after-paragraph-sign",
      category: "typography",
      pattern: /(§)\s+(\d+)/g,
      replacement: (_match, sign, num) => `${sign}${NBSP}${num}`,
      message: MSG_TYPO_NBSP_NUMBER,
      priority: 53,
    }),
    ...buildQuotesRules(),
    rule({
      id: "cian-118-ellipsis-three-dots",
      category: "typography",
      pattern: /\.{3}/g,
      replacement: "…",
      message: MSG_TYPO_ELLIPSIS,
      priority: 47,
    }),
  ]);
}
