import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import {
  LATIN_CYRILLIC_WORD_EDGE_END,
  LATIN_CYRILLIC_WORD_LOOKBEHIND,
} from "../regex";
import { HORIZONTAL_SPACE } from "../typography/constants";

/** Кириллица «СМС» и латиница «SMS»; регистр — через флаг i. */
const SMS_FORMS = String.raw`(?:СМС|SMS)`;
const NOT_SENTENCE_START = String.raw`(?<!^)(?<![.!?…]${HORIZONTAL_SPACE}*)`;
const AT_SENTENCE_START = String.raw`(?<=^|[.!?…]${HORIZONTAL_SPACE}*|[\r\n]${HORIZONTAL_SPACE}*)`;

export function buildSmsRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-sms-sentence-start",
      category: "cian_editorial",
      pattern: new RegExp(
        `${AT_SENTENCE_START}(${SMS_FORMS})${LATIN_CYRILLIC_WORD_EDGE_END}`,
        "iu",
      ),
      replacement: (_match, _word) => "Смс",
      message: "Редполитика: «СМС» / «SMS» в начале предложения → «Смс».",
      priority: 72,
    }),
    rule({
      id: "cian-sms-mid-sentence",
      category: "cian_editorial",
      pattern: new RegExp(
        `${NOT_SENTENCE_START}${LATIN_CYRILLIC_WORD_LOOKBEHIND}(${SMS_FORMS})${LATIN_CYRILLIC_WORD_EDGE_END}`,
        "iu",
      ),
      replacement: (_match, _word) => "смс",
      message: "Редполитика: «СМС» / «SMS» в середине предложения → «смс».",
      priority: 71,
    }),
  ]);
}
