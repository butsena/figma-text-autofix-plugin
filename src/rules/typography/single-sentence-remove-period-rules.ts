import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_RED_POLICY_SINGLE_SENTENCE_NO_PERIOD } from "../rule-messages";
import { removeSingleSentenceTerminalPeriod } from "./sentence-split";

export function buildSingleSentenceRemovePeriodRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-139b-single-sentence-remove-period",
      category: "cian_editorial",
      pattern: /^[\s\S]+$/u,
      replacement: (text) => removeSingleSentenceTerminalPeriod(text),
      message: MSG_RED_POLICY_SINGLE_SENTENCE_NO_PERIOD,
      priority: 89,
    }),
  ]);
}
