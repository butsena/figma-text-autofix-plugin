import { matchingChoiceOptionIndex } from "../shared/choice-option-match";
import { choiceSelectionKey, state } from "./ui-state";

/** Явный клик пользователя или форма, уже стоящая в тексте. */
export function selectedChoiceOptionIndex(
  cardIdx: number,
  fixIdx: number,
  before: string,
  options: readonly string[],
): number | null {
  const key = choiceSelectionKey(cardIdx, fixIdx);
  if (Object.prototype.hasOwnProperty.call(state.choiceSelection, key)) {
    return state.choiceSelection[key]!;
  }
  return matchingChoiceOptionIndex(before, options);
}
