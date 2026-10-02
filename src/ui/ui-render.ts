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
  renderSpellcheckStatusHtml,
  renderTechDetailsHtml,
  renderTextLayersHtml,
} from "./ui-render-sections";
import { escapeHtml } from "../shared/escape-html";

export function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  captureUiAccordionState();

  if (state.spellcheckInProgress) {
    app.innerHTML = `
    <div class="appShell">
      <div class="appMain">
        ${renderSpellcheckStatusHtml()}
      </div>
    </div>
  `;
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
        ${renderLeftoverCardsHtml()}
        ${renderTextLayersHtml()}
        ${renderReportThanksHtml()}
      </div>
      ${renderTechDetailsHtml()}
    </div>
  `;

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
