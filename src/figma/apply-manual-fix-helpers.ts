import { isChoicePolicy } from "../core/apply-policy";
import { isOrthographyRuleId } from "../rules/orthography-spell-rules";
import type { TextFixDto } from "../shared/messages";
import { findChosenWordNear } from "./choice-resolution-core";

export function isPersistedManualResolution(fix: TextFixDto): boolean {
  return isChoicePolicy(fix.rule.applyPolicy) || isOrthographyRuleId(fix.rule.id);
}

/** Диапазон выбранного слова после apply (с учётом сдвига текста). */
export function resolveChosenWordRangeAfterApply(
  text: string,
  fix: Pick<TextFixDto, "from" | "before" | "after">,
): { from: number; to: number } {
  const chosen = fix.after;
  let from = fix.from;
  let to = fix.from + chosen.length;

  const wordAtExpected = text.slice(from, to);
  if (wordAtExpected !== chosen) {
    const found = findChosenWordNear(text, chosen, fix.from);
    if (found != null) {
      from = found;
      to = found + chosen.length;
    }
  }

  return { from, to };
}
