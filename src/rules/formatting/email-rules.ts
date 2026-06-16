import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";
import { MSG_NORMALIZE_EMAIL } from "../rule-messages";

export function buildEmailRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-010-e-mail-to-email-caps",
      category: "text_formatting",
      pattern: /E-mail/g,
      replacement: "Email",
      message: MSG_NORMALIZE_EMAIL,
      priority: 90,
    }),
    rule({
      id: "cian-011-e-mail-to-email-lower",
      category: "text_formatting",
      pattern: /e-mail/g,
      replacement: "email",
      message: MSG_NORMALIZE_EMAIL,
      priority: 90,
    }),
  ]);
}
