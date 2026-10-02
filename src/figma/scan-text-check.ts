import { checkTextForAutofixes, type TextFix } from "../core/autofix-engine";
import type { ApplyPolicy } from "../core/apply-policy";
import { resolveApplyPolicy } from "../core/apply-policy";
import { getAutofixRules } from "../rules/autofix-rules";
import {
  ORTHOGRAPHY_LAYOUT_RULE_ID,
  isOrthographyRuleId,
} from "../rules/orthography-spell-rules";
import { compareFixesByPosition } from "../shared/fix-sort";
import { rangesOverlap } from "../shared/ranges-overlap";
import { checkSpellingFixes } from "../spell/check-spelling";

export type ScanPolicyFilter = ApplyPolicy | "all";

const SENTENCE_CAP_RULE_IDS = new Set([
  "cian-138-sentence-start-capitalize",
  "cian-138-numbered-list-capitalize",
]);

export function filterRulesByPolicy(policy: ScanPolicyFilter) {
  const all = getAutofixRules();
  if (policy === "all") return all;
  return all.filter((rule) => resolveApplyPolicy(rule.applyPolicy) === policy);
}

/**
 * Заглавная в начале предложения бессмысленна, если на ту же букву уже
 * висит орфография без подсказки (мусор) или раскладка (слово целиком заменится).
 */
export function dropSentenceCapOverlappingOrthography(fixes: readonly TextFix[]): TextFix[] {
  const orthography = fixes.filter((f) => isOrthographyRuleId(f.ruleId));
  if (!orthography.length) return fixes as TextFix[];

  return fixes.filter((fix) => {
    if (!SENTENCE_CAP_RULE_IDS.has(fix.ruleId)) return true;
    return !orthography.some((o) => {
      if (!rangesOverlap(fix.from, fix.to, o.from, o.to)) return false;
      if (o.ruleId === ORTHOGRAPHY_LAYOUT_RULE_ID) return true;
      return o.before === o.after;
    });
  });
}

export function mergeAutofixAndSpellingFixes(text: string, fixes: TextFix[]): TextFix[] {
  // Заглавная на одну букву не должна перекрывать орфографию целого слова:
  // иначе на мусоре «ъъъ…» остаётся только capitalize, а spell-карточки нет.
  const sentenceCaps = fixes.filter((f) => SENTENCE_CAP_RULE_IDS.has(f.ruleId));
  const otherFixes = fixes.filter((f) => !SENTENCE_CAP_RULE_IDS.has(f.ruleId));
  const spellFixes = checkSpellingFixes(text, otherFixes);
  if (!spellFixes.length) return fixes;
  return dropSentenceCapOverlappingOrthography([
    ...otherFixes,
    ...sentenceCaps,
    ...spellFixes,
  ]).sort(compareFixesByPosition);
}

export function checkTextWithSpelling(
  text: string,
  rules: ReturnType<typeof filterRulesByPolicy>,
): TextFix[] {
  const { fixes } = checkTextForAutofixes(text, rules);
  return mergeAutofixAndSpellingFixes(text, fixes);
}

/** Только autofix-правила, без Hunspell (для цикла auto-apply). */
export function checkTextForAutofixesOnly(
  text: string,
  rules: ReturnType<typeof filterRulesByPolicy>,
): TextFix[] {
  return checkTextForAutofixes(text, rules).fixes;
}
