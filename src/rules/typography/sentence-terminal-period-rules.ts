import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_RED_POLICY_SENTENCE_PERIOD } from "../rule-messages";
import { ensureSentenceTerminalPeriods } from "./sentence-split";

export function buildSentenceTerminalPeriodRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-139-sentence-terminal-period",
      category: "cian_editorial",
      pattern: /^[\s\S]+$/u,
      replacement: (text) => ensureSentenceTerminalPeriods(text),
      message: MSG_RED_POLICY_SENTENCE_PERIOD,
      priority: 88,
    }),
  ]);
}
