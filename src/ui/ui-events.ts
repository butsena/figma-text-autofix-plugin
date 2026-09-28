import { parseKey } from "./ui-event-keys";
import {
  applyConfirmFix,
  applySpellFix,
  confirmChoiceSelection,
  selectChoiceOption,
  skipConfirmFix,
  skipSpellFix,
  syncSpellApplyButton,
} from "./ui-event-actions";
import { sendToPlugin } from "./ui-plugin-bridge";
import { schedulePluginResize } from "./ui-resize";
import { syncAccordionStateFromElement } from "./ui-state";

function handleAppClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const spellApply = target.closest("[data-spell-apply]");
  if (spellApply instanceof HTMLButtonElement) {
    event.stopPropagation();
    if (spellApply.disabled) return;
    const parts = parseKey(spellApply.getAttribute("data-spell-apply"), 2);
    if (!parts) return;
    applySpellFix(parts[0], parts[1]);
    return;
  }

  const spellSkip = target.closest("[data-spell-skip]");
  if (spellSkip instanceof HTMLElement) {
    event.stopPropagation();
    const parts = parseKey(spellSkip.getAttribute("data-spell-skip"), 2);
    if (!parts) return;
    skipSpellFix(parts[0], parts[1]);
    return;
  }

  const confirmApply = target.closest("[data-confirm-apply]");
  if (confirmApply instanceof HTMLElement) {
    event.stopPropagation();
    const parts = parseKey(confirmApply.getAttribute("data-confirm-apply"), 2);
    if (!parts) return;
    applyConfirmFix(parts[0], parts[1]);
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

function handleAppInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.classList.contains("spellInput")) return;
  const parts = parseKey(target.getAttribute("data-spell-input"), 2);
  if (!parts) return;
  syncSpellApplyButton(parts[0], parts[1]);
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
  app.addEventListener("input", handleAppInput);
  app.addEventListener("toggle", handleAppToggle, true);
}
