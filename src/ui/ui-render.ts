import { escapeHtml } from "./ui-helpers";
import { schedulePluginResize } from "./ui-resize";
import { captureUiAccordionState, state } from "./ui-state";
import {
  renderChoiceHtml,
  renderConfirmHtml,
  renderReportHtml,
  renderResultHeaderHtml,
  renderTechDetailsHtml,
  renderTextLayersHtml,
} from "./ui-render-sections";

const REPORT_THANKS_HTML =
  '<div class="reportThanksRow">' +
  '<button id="thanksBtn" type="button" class="thanksBtn">Спасибо, шайтан-машина!</button>' +
  "</div>";

export function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  captureUiAccordionState();

  const resultHeaderHtml = renderResultHeaderHtml();
  const textLayersHtml = renderTextLayersHtml();
  const confirmHtml = renderConfirmHtml();
  const choiceHtml = renderChoiceHtml();
  const reportHtml = renderReportHtml();
  const thanksHtml = state.summary ? REPORT_THANKS_HTML : "";

  let bodyHtml = "";
  if (state.cards.length) {
    bodyHtml = state.cards
      .map((c) => {
        return `
          <div class="card cardClickable" data-node-id="${escapeHtml(c.nodeId)}">
            <div class="cardTitle">${escapeHtml(c.nodeName || "Без имени")}</div>
            <div class="fieldLabel">Текст слоя сейчас</div>
            <div class="textPreview">${escapeHtml(c.originalText)}</div>
            <div class="fieldLabel" style="color:#888;font-size:11px">Если снова нужны правки — измените текст или выделение и снова запустите плагин.</div>
          </div>
        `;
      })
      .join("");
  }

  const techDetailsHtml = renderTechDetailsHtml();

  app.innerHTML = `
    <div class="appShell">
      <div class="appMain">
        ${resultHeaderHtml}
        ${reportHtml}
        ${choiceHtml}
        ${confirmHtml}
        ${
          state.cards.length
            ? `<div class="sectionTitle">Оставшиеся совпадения (если есть)</div><div class="cards">${bodyHtml}</div>`
            : ""
        }
        ${textLayersHtml}
        ${thanksHtml}
      </div>
      ${techDetailsHtml}
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
