import { captureScrollTop, restoreScrollTop } from "./ui-scroll";
import { schedulePluginResize } from "./ui-resize";
import { captureUiAccordionState, setDetailsOpen, state } from "./ui-state";
import {
  renderChoiceHtml,
  renderConfirmHtml,
  renderLeftoverCardsHtml,
  renderManualReportHtml,
  renderReportHtml,
  renderReportThanksHtml,
  renderResultHeaderHtml,
  renderSpellcheckActionHtml,
  renderSpellcheckStatusHtml,
  renderTechDetailsHtml,
  renderTextLayersHtml,
} from "./ui-render-sections";
import { escapeHtml } from "../shared/escape-html";

export function render(options?: { keepAccordionState?: boolean }): void {
  const app = document.getElementById("app");
  if (!app) return;

  if (!options?.keepAccordionState) captureUiAccordionState();
  captureScrollTop();

  if (state.spellcheckInProgress && state.summary) {
    app.innerHTML = `
    <div class="appShell">
      <div class="appMain">
        ${renderSpellcheckStatusHtml()}
      </div>
    </div>
  `;
    restoreScrollTop();
    schedulePluginResize();
    return;
  }

  app.innerHTML = `
    <div class="appShell">
      <div class="appMain">
        ${renderResultHeaderHtml()}
        ${renderSpellcheckStatusHtml()}
        ${renderSpellcheckActionHtml()}
        ${renderConfirmHtml()}
        ${renderChoiceHtml()}
        ${renderManualReportHtml()}
        ${renderReportHtml()}
        ${renderLeftoverCardsHtml()}
        ${renderTextLayersHtml()}
        ${renderReportThanksHtml()}
      </div>
      ${renderTechDetailsHtml()}
    </div>
  `;

  restoreScrollTop();
  schedulePluginResize();
}

/** Только эта секция. Сам `<details>` не подменяем: иначе клик браузера открывает уже новый блок. */
export function rerenderAccordion(details: HTMLDetailsElement, open: boolean): void {
  if (!setDetailsOpen(details, open)) {
    render({ keepAccordionState: true });
    return;
  }
  const html = accordionBlockHtml(details);
  const block = details.parentElement;
  if (!html || !block) {
    render({ keepAccordionState: true });
    return;
  }
  if (typeof document === "undefined" || !details.isConnected) {
    block.outerHTML = html.trim();
    schedulePluginResize();
    return;
  }
  const holder = document.createElement("div");
  holder.innerHTML = html.trim();
  const nextDetails = holder.querySelector("details");
  if (!(nextDetails instanceof HTMLDetailsElement)) {
    block.outerHTML = html.trim();
    schedulePluginResize();
    return;
  }
  details.innerHTML = nextDetails.innerHTML;
  details.open = open;
  schedulePluginResize();
}

function accordionBlockHtml(details: HTMLDetailsElement): string {
  if (details.classList.contains("confirmDetails")) return renderConfirmHtml();
  if (details.classList.contains("choiceDetails")) return renderChoiceHtml();
  if (details.classList.contains("manualReportDetails")) return renderManualReportHtml();
  if (details.classList.contains("reportDetails")) return renderReportHtml();
  if (details.classList.contains("techDetails")) return renderTechDetailsHtml();
  return "";
}

export function renderPluginError(message: string): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML =
    '<div style="color:#b00020;padding:12px"><b>Ошибка плагина</b><br>' +
    escapeHtml(message || "Неизвестная ошибка") +
    "</div>";
}
