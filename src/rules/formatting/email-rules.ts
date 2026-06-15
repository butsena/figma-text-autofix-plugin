import type { AutofixRule } from "../../core/autofix-engine";
import { rule, rules } from "../../core/rule-def";

export function buildEmailRules(): AutofixRule[] {
  return rules([
    rule({
      id: "cian-010-e-mail-to-email-caps",
      category: "text_formatting",
      pattern: /E-mail/g,
      replacement: "Email",
      message: "Нормализовать «E-mail» → «Email».",
      priority: 90,
    }),
    rule({
      id: "cian-011-e-mail-to-email-lower",
      category: "text_formatting",
      pattern: /e-mail/g,
      replacement: "email",
      message: "Нормализовать «e-mail» → «email».",
      priority: 90,
    }),
  ]);
}
