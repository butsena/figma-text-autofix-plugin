import {
  applyTextFixes,
  checkTextForAutofixes,
  type AutofixRule,
  type TextFix,
} from "../core/autofix-engine";

export function fixesFor(text: string, rules: AutofixRule[]): TextFix[] {
  return checkTextForAutofixes(text, rules).fixes;
}

export function autoFixesFor(text: string, rules: AutofixRule[]): TextFix[] {
  return fixesFor(text, rules).filter((f) => f.applyPolicy !== "confirm");
}

export function applyAllRules(text: string, rules: AutofixRule[]): string {
  return applyTextFixes(text, autoFixesFor(text, rules));
}

export function fixByRuleId(
  text: string,
  rules: AutofixRule[],
  ruleId: string,
): TextFix | undefined {
  return fixesFor(text, rules).find((f) => f.ruleId === ruleId);
}
