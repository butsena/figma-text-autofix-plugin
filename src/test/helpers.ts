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
