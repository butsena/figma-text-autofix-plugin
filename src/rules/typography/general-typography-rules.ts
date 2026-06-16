import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import {
  MSG_TYPO_ELLIPSIS,
  MSG_TYPO_NBSP_NUMBER,
  MSG_TYPO_NBSP_PERCENT,
  MSG_TYPO_REMOVE_EXTRA_LINE_BREAK,
  MSG_TYPO_REMOVE_EXTRA_SPACE,
} from "../rule-messages";
import { EMPTY_LINE_BREAKS_PATTERN, NBSP } from "./constants";
import { buildEmdashRules } from "./emdash-rules";
import { buildPhoneRules } from "./phone-rules";
import { buildQuotesRules } from "./quotes-rules";

export function buildGeneralTypographyRules(): AutofixRule[] {
  return rules([
    ...buildPhoneRules(),
    rule({
      id: "cian-110-nbsp-number-unit",
      category: "typography",
      pattern:
        /(\d+(?:[ \u00A0\u202F]\d{3})*(?:[.,]\d+)?)\s+(°C|°F|мм|см|м|км|г|кг|мг|л|мл|ч|мин|с|м²|м³|руб\.?|₽|р\.?)(?=[^\p{L}\p{N}]|$)/giu,
      replacement: (_match, num, unit) => `${num}${NBSP}${unit}`,
      message: MSG_TYPO_NBSP_NUMBER,
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
      id: "cian-121-remove-empty-line-breaks",
      category: "typography",
      pattern: EMPTY_LINE_BREAKS_PATTERN,
      replacement: "",
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
