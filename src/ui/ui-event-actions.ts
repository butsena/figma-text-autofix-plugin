import type { TextFixDto } from "../shared/messages";
import { capitalizeLike, replacementFromSpellInput } from "../shared/case";
import { classifySpellingSource } from "../shared/spelling-source";
import { countConfirmFixes } from "./ui-helpers";
import { sendToPlugin } from "./ui-plugin-bridge";
import { render } from "./ui-render";
import { selectedChoiceOptionIndex } from "./choice-selection";
import { choiceSelectionKey, state } from "./ui-state";

export function skipConfirmFix(cardIdx: number, fixIdx: number): void {
  const card = state.confirmCards[cardIdx];
  if (!card || !card.fixes[fixIdx]) return;
  card.fixes.splice(fixIdx, 1);
  if (card.fixes.length === 0) {
    state.confirmCards.splice(cardIdx, 1);
  }
  if (state.summary) {
    state.summary.confirmFixes = countConfirmFixes(state.confirmCards);
  }
  render();
}

function readSpellInputValue(cardIdx: number, fixIdx: number): string {
  const input = document.querySelector(
    `input.spellInput[data-spell-input="${cardIdx}:${fixIdx}"]`,
  );
  if (!(input instanceof HTMLInputElement)) return "";
  return input.value.trim();
}

export function syncSpellApplyButton(cardIdx: number, fixIdx: number): void {
  const card = state.confirmCards[cardIdx];
  const fix = card?.fixes[fixIdx];
  if (!fix) return;
  const value = readSpellInputValue(cardIdx, fixIdx);
  const btn = document.querySelector(
    `button[data-spell-apply="${cardIdx}:${fixIdx}"]`,
  );
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.disabled = !value || value === fix.before;
}

export function applySpellFix(cardIdx: number, fixIdx: number): void {
  const card = state.confirmCards[cardIdx];
  if (!card) return;
  const fix = card.fixes[fixIdx];
  if (!fix) return;

  const typed = readSpellInputValue(cardIdx, fixIdx);
  if (!typed || typed === fix.before) return;

  const after = replacementFromSpellInput(fix.before, fix.after, typed);
  state.ui.confirmDetailsOpen = true;
  sendToPlugin({
    type: "ui:applyManualFix",
    nodeId: card.nodeId,
    spellingSource: classifySpellingSource(fix.before, fix.after, after),
    fix: {
      ...fix,
      after,
      rule: {
        ...fix.rule,
        applyPolicy: fix.rule.applyPolicy,
      },
    },
  });
}

export function skipSpellFix(cardIdx: number, fixIdx: number): void {
  const card = state.confirmCards[cardIdx];
  if (!card) return;
  const fix = card.fixes[fixIdx];
  if (!fix) return;

  state.ui.confirmDetailsOpen = true;
  sendToPlugin({
    type: "ui:skipManualFix",
    nodeId: card.nodeId,
    fix: fix as TextFixDto,
  });
}

export function applyConfirmFix(cardIdx: number, fixIdx: number): void {
  const card = state.confirmCards[cardIdx];
  if (!card) return;
  const fix = card.fixes[fixIdx];
  if (!fix) return;
  state.ui.confirmDetailsOpen = true;
  sendToPlugin({
    type: "ui:applyManualFix",
    nodeId: card.nodeId,
    fix: fix as TextFixDto,
  });
}

export function selectChoiceOption(cardIdx: number, fixIdx: number, optionIdx: number): void {
  state.choiceSelection[choiceSelectionKey(cardIdx, fixIdx)] = optionIdx;
  state.ui.choiceDetailsOpen = true;
  render();
}

export function confirmChoiceSelection(cardIdx: number, fixIdx: number): void {
  const card = state.choiceCards[cardIdx];
  if (!card) return;
  const fix = card.fixes[fixIdx];
  if (!fix) return;

  const selectionKey = choiceSelectionKey(cardIdx, fixIdx);
  const options = fix.rule?.choiceOptions ?? [];
  const optionIdx = selectedChoiceOptionIndex(cardIdx, fixIdx, fix.before, options);
  const option = optionIdx != null ? options[optionIdx] : undefined;
  if (!option) return;

  delete state.choiceSelection[selectionKey];

  const chosen = capitalizeLike(fix.before, option);
  state.ui.choiceDetailsOpen = true;
  sendToPlugin({
    type: "ui:applyManualFix",
    nodeId: card.nodeId,
    fix: {
      ...fix,
      after: chosen,
      rule: {
        ...fix.rule,
        applyPolicy: fix.rule.applyPolicy,
      },
    },
  });
}
