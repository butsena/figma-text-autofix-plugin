import {
  applyTextFixes,
  checkTextForAutofixes,
  type AutofixRule,
  type TextFix,
} from "../core/autofix-engine";

export function fixesFor(text: string, rules: AutofixRule[]): TextFix[] {
  return checkTextForAutofixes(text, rules).fixes;
}

export function applyAllRules(text: string, rules: AutofixRule[]): string {
  return applyTextFixes(text, fixesFor(text, rules));
}

export function fixByRuleId(
  text: string,
  rules: AutofixRule[],
  ruleId: string,
): TextFix | undefined {
  return fixesFor(text, rules).find((f) => f.ruleId === ruleId);
}
