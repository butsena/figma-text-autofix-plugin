import type { AutofixRule } from "../../core/autofix-engine";
import { APPLY_POLICY_CONFIRM } from "../../core/apply-policy";
import { rule, rules } from "../../core/rule-def";
import { MSG_CONFIRM_IMPLICIT_SENTENCE_PERIOD } from "../rule-messages";
import { insertImplicitSentencePeriods } from "./sentence-split";

export function buildImplicitSentencePeriodRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-139a-implicit-sentence-period",
      category: "cian_editorial",
      pattern: /^[\s\S]+$/u,
      replacement: (text) => insertImplicitSentencePeriods(text),
      message: MSG_CONFIRM_IMPLICIT_SENTENCE_PERIOD,
      priority: 87,
      applyPolicy: APPLY_POLICY_CONFIRM,
    }),
  ]);
}
