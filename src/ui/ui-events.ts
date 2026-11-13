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
import { FIX_CARD_PAGE, FIX_ROW_PAGE } from "./list-window";
import { sendToPlugin } from "./ui-plugin-bridge";
import { render, rerenderAccordion } from "./ui-render";
import {
  applySpellcheckPreference,
  readDetailsOpen,
  state,
} from "./ui-state";

function eventElement(event: Event): Element | null {
  const target = event.target;
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

/** Пока возвращаем `open` к нашему флагу, вложенный toggle не должен крутиться снова. */
let enforcingDetailsOpen = false;

function handleAppClick(event: Event): void {
  const target = eventElement(event);
  if (!target) return;

  if (target.closest("[data-more-group], [data-show-more], [data-confirm-apply], [data-confirm-skip], [data-spell-apply], [data-spell-skip], [data-choice-pick], [data-choice-confirm]")) {
    event.preventDefault();
  }

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

  const moreGroup = target.closest("[data-more-group]");
  if (moreGroup instanceof HTMLElement) {
    event.stopPropagation();
    const key = moreGroup.getAttribute("data-more-group");
    if (key) {
      state.expandedGroups[key] = (state.expandedGroups[key] ?? FIX_CARD_PAGE) + FIX_CARD_PAGE;
      render();
    }
    return;
  }

  const showMore = target.closest("[data-show-more]");
  if (showMore instanceof HTMLElement) {
    event.stopPropagation();
    const which = showMore.getAttribute("data-show-more");
    if (which === "report") state.reportShown += FIX_ROW_PAGE;
    else if (which === "manual") state.manualReportShown += FIX_ROW_PAGE;
    render();
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

  const spellcheckBtn = target.closest("#spellcheckBtn");
  if (spellcheckBtn) {
    applySpellcheckPreference(true);
    // Пока пайплайн перезапускается — без старых карточек.
    state.summary = null;
    state.confirmCards = [];
    state.choiceCards = [];
    state.cards = [];
    state.lastReport = null;
    state.lastManualReport = null;
    render();
    sendToPlugin({ type: "ui:enableSpellcheck" });
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

function enforceDetailsOpen(details: HTMLDetailsElement, open: boolean): void {
  if (!details.isConnected || details.open === open || enforcingDetailsOpen) return;
  enforcingDetailsOpen = true;
  details.open = open;
  enforcingDetailsOpen = false;
}

function handleSummaryClick(event: Event): void {
  const target = eventElement(event);
  const summary = target?.closest("summary");
  const details = summary?.parentElement;
  if (!summary || !(details instanceof HTMLDetailsElement)) return;
  const current = readDetailsOpen(details);
  if (current == null) return;
  event.preventDefault();
  event.stopPropagation();
  const next = !current;
  rerenderAccordion(details, next);
  // Дефолт клика срабатывает после слушателя и снова ставит open.
  queueMicrotask(() => enforceDetailsOpen(details, next));
  setTimeout(() => enforceDetailsOpen(details, next), 0);
}

function handleAppToggle(event: Event): void {
  if (enforcingDetailsOpen) return;
  const target = event.target;
  if (!(target instanceof HTMLDetailsElement)) return;
  const intended = readDetailsOpen(target);
  if (intended == null) return;
  enforceDetailsOpen(target, intended);
}

export function initUiEvents(): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.addEventListener("click", handleSummaryClick, true);
  app.addEventListener("click", handleAppClick);
  app.addEventListener("input", handleAppInput);
  app.addEventListener("toggle", handleAppToggle, true);
}
