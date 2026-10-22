import { captureScrollTop, restoreScrollTop } from "./ui-scroll";
import { schedulePluginResize } from "./ui-resize";
import { captureUiAccordionState, state } from "./ui-state";
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

export function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  captureUiAccordionState();
  captureScrollTop();

  if (state.spellcheckInProgress) {
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
        ${renderConfirmHtml()}
        ${renderChoiceHtml()}
        ${renderManualReportHtml()}
        ${renderReportHtml()}
        ${renderSpellcheckActionHtml()}
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

export function renderPluginError(message: string): void {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML =
    '<div style="color:#b00020;padding:12px"><b>Ошибка плагина</b><br>' +
    escapeHtml(message || "Неизвестная ошибка") +
    "</div>";
}
