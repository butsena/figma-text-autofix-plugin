import type { TextFixDto } from "../shared/messages";
import { capitalizeLike, countConfirmFixes } from "./ui-helpers";
import { sendToPlugin } from "./ui-plugin-bridge";
import { render } from "./ui-render";
import { schedulePluginResize } from "./ui-resize";
import { selectedChoiceOptionIndex } from "./choice-selection";
import {
  choiceSelectionKey,
  state,
  syncAccordionStateFromElement,
} from "./ui-state";

function parseKey(key: string | null, parts: number): number[] | null {
  if (!key) return null;
  const values = key.split(":").map(Number);
  if (values.length !== parts || values.some((value) => Number.isNaN(value))) {
    return null;
  }
  return values;
}

function skipConfirmFix(cardIdx: number, fixIdx: number): void {
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

function selectChoiceOption(cardIdx: number, fixIdx: number, optionIdx: number): void {
  state.choiceSelection[choiceSelectionKey(cardIdx, fixIdx)] = optionIdx;
  state.ui.choiceDetailsOpen = true;
  render();
}

function confirmChoiceSelection(cardIdx: number, fixIdx: number): void {
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

function handleAppClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const confirmApply = target.closest("[data-confirm-apply]");
  if (confirmApply instanceof HTMLElement) {
    event.stopPropagation();
    const parts = parseKey(confirmApply.getAttribute("data-confirm-apply"), 2);
    if (!parts) return;
    const [cardIdx, fixIdx] = parts;
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
    return;
  }

  const confirmSkip = target.closest("[data-confirm-skip]");
  if (confirmSkip instanceof HTMLElement) {
    event.stopPropagation();
    const parts = parseKey(confirmSkip.getAttribute("data-confirm-skip"), 2);
    if (!parts) return;
    skipConfirmFix(parts[0], parts[1]);
    return;
  }

  const choicePick = target.closest("[data-choice-pick]");
  if (choicePick instanceof HTMLElement) {
    event.stopPropagation();
    const parts = parseKey(choicePick.getAttribute("data-choice-pick"), 3);
    if (!parts) return;
    selectChoiceOption(parts[0], parts[1], parts[2]);
    return;
  }

  const choiceConfirm = target.closest("[data-choice-confirm]");
  if (choiceConfirm instanceof HTMLButtonElement) {
    event.stopPropagation();
    if (choiceConfirm.disabled) return;
    const parts = parseKey(choiceConfirm.getAttribute("data-choice-confirm"), 2);
    if (!parts) return;
    confirmChoiceSelection(parts[0], parts[1]);
    return;
  }

  const thanksBtn = target.closest("#thanksBtn");
  if (thanksBtn) {
    sendToPlugin({ type: "ui:close" });
    return;
  }

  const layerTitle = target.closest(".reportLayerTitle[data-node-id], .card[data-node-id]");
  if (layerTitle instanceof HTMLElement) {
    const nodeId = layerTitle.getAttribute("data-node-id");
    if (nodeId) {
      sendToPlugin({ type: "ui:focusLayer", nodeId });
    }
  }
}

function handleAppToggle(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLDetailsElement)) return;
  syncAccordionStateFromElement(target);
  schedulePluginResize();
}

export function initUiEvents(): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.addEventListener("click", handleAppClick);
  app.addEventListener(
    "toggle",
    handleAppToggle,
    true,
  );
}
