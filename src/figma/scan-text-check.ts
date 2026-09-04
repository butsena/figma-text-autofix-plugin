import { checkTextForAutofixes, type TextFix } from "../core/autofix-engine";
import type { ApplyPolicy } from "../core/apply-policy";
import { resolveApplyPolicy } from "../core/apply-policy";
import { getAutofixRules } from "../rules/autofix-rules";
import { checkSpellingFixes } from "../spell/check-spelling";

export type ScanPolicyFilter = ApplyPolicy | "all";

export function filterRulesByPolicy(policy: ScanPolicyFilter) {
  const all = getAutofixRules();
  if (policy === "all") return all;
  return all.filter((rule) => resolveApplyPolicy(rule.applyPolicy) === policy);
}

export function mergeAutofixAndSpellingFixes(text: string, fixes: TextFix[]): TextFix[] {
  const spellFixes = checkSpellingFixes(text, fixes);
  if (!spellFixes.length) return fixes;
  return [...fixes, ...spellFixes].sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return a.to - b.to;
    return b.priority - a.priority;
  });
}

export function checkTextWithSpelling(
  text: string,
  rules: ReturnType<typeof filterRulesByPolicy>,
): TextFix[] {
  const { fixes } = checkTextForAutofixes(text, rules);
  return mergeAutofixAndSpellingFixes(text, fixes);
}
