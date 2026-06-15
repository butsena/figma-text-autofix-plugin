import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { CYRILLIC_WORD_EDGE, CYRILLIC_WORD_EDGE_END } from "../regex";
import { HORIZONTAL_SPACE } from "../typography/constants";

const SMS_WORD = "СМС";
const NOT_SENTENCE_START = String.raw`(?<!^)(?<![.!?…]${HORIZONTAL_SPACE}*)`;
const SENTENCE_START = String.raw`(?:^|[.!?…]${HORIZONTAL_SPACE}*|[\r\n]${HORIZONTAL_SPACE}*)`;

export function buildSmsRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-sms-sentence-start",
      category: "cian_editorial",
      pattern: new RegExp(`(${SENTENCE_START})(${SMS_WORD})${CYRILLIC_WORD_EDGE_END}`, "gu"),
      replacement: (_match, prefix) => `${prefix}Смс`,
      message: "Редполитика: «СМС» в начале предложения → «Смс».",
      priority: 72,
    }),
    rule({
      id: "cian-sms-mid-sentence",
      category: "cian_editorial",
      pattern: new RegExp(
        `${NOT_SENTENCE_START}${CYRILLIC_WORD_EDGE}(${SMS_WORD})${CYRILLIC_WORD_EDGE_END}`,
        "gu",
      ),
      replacement: (_match, prefix) => `${prefix}смс`,
      message: "Редполитика: «СМС» в середине предложения → «смс».",
      priority: 71,
    }),
  ]);
}
