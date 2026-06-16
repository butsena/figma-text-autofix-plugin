import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_TYPO_QUOTES } from "../rule-messages";

export function buildQuotesRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-119-quotes-ascii-to-guillemets",
      category: "typography",
      pattern: /"([^"]*)"/g,
      replacement: (_match, inner) => `«${inner}»`,
      message: MSG_TYPO_QUOTES,
      priority: 44,
    }),
    rule({
      id: "cian-120-quotes-curly-unicode-to-guillemets",
      category: "typography",
      pattern: /\u201C([^\u201C\u201D]+)\u201D/g,
      replacement: (_match, inner) => `«${inner}»`,
      message: MSG_TYPO_QUOTES,
      priority: 45,
    }),
  ]);
}
