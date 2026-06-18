import { formatFixDiffHtml } from "./diff-format";
import {
  countConfirmFixes,
  detailsOpenAttr,
  displayText,
  escapeHtml,
  formatFixCategoryLabel,
} from "./ui-helpers";
import {
  PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MIN_HEIGHT,
  PLUGIN_UI_WIDTH,
} from "../shared/plugin-ui-layout";
import type {
  AutoApplyReportDto,
  PluginToUiMessage,
  SheetLoadStatusDto,
  TextFixDto,
  TextNodeCardDto,
  UiToPluginMessage,
} from "../shared/messages";

type UiState = {
  summary: {
    checkedLayers: number;
    foundFixes: number;
    confirmFixes: number;
  } | null;
  cards: TextNodeCardDto[];
  confirmCards: TextNodeCardDto[];
  lastReport: AutoApplyReportDto | null;
  sheetLoad: SheetLoadStatusDto | null;
  ui: {
    confirmDetailsOpen: boolean;
    reportDetailsOpen: boolean;
    techDetailsOpen: boolean;
  };
};

const state: UiState = {
  summary: null,
  cards: [],
  confirmCards: [],
  lastReport: null,
  sheetLoad: null,
  ui: {
    confirmDetailsOpen: true,
    reportDetailsOpen: false,
    techDetailsOpen: false,
  },
};

function sendToPlugin(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

const PLUGIN_UI_MAX_HEIGHT_CAPPED = Math.min(
  window.screen && window.screen.availHeight ? window.screen.availHeight - 64 : PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MAX_HEIGHT,
);

function computePluginContentHeight(): number {
  return Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
}

function applyPluginScrollMode(contentHeight: number): void {
  const capped = contentHeight > PLUGIN_UI_MAX_HEIGHT_CAPPED;
  const overflow = capped ? "auto" : "";
  document.documentElement.style.overflowY = overflow;
  document.body.style.overflowY = overflow;
}

let pluginResizeFrame = 0;
function schedulePluginResize(): void {
  if (pluginResizeFrame) {
    cancelAnimationFrame(pluginResizeFrame);
  }
  pluginResizeFrame = requestAnimationFrame(function () {
    pluginResizeFrame = requestAnimationFrame(function () {
      pluginResizeFrame = 0;
      const contentHeight = computePluginContentHeight();
      const targetHeight = Math.max(
        PLUGIN_UI_MIN_HEIGHT,
        Math.min(PLUGIN_UI_MAX_HEIGHT_CAPPED, contentHeight),
      );
      applyPluginScrollMode(contentHeight);
      sendToPlugin({
        type: "ui:resize",
        width: PLUGIN_UI_WIDTH,
        height: targetHeight,
      });
    });
  });
}

function captureUiAccordionState(): void {
  const confirmEl = document.querySelector("details.confirmDetails");
  if (confirmEl instanceof HTMLDetailsElement) state.ui.confirmDetailsOpen = confirmEl.open;
  const reportEl = document.querySelector("details.reportDetails");
  if (reportEl instanceof HTMLDetailsElement) state.ui.reportDetailsOpen = reportEl.open;
  const techEl = document.querySelector("details.techDetails");
  if (techEl instanceof HTMLDetailsElement) state.ui.techDetailsOpen = techEl.open;
}

function wireAccordionResize(): void {
  document
    .querySelectorAll("details.reportDetails, details.confirmDetails, details.techDetails")
    .forEach(function (el) {
      el.addEventListener("toggle", function () {
        if (el.classList.contains("confirmDetails")) {
          state.ui.confirmDetailsOpen = (el as HTMLDetailsElement).open;
        } else if (el.classList.contains("reportDetails")) {
          state.ui.reportDetailsOpen = (el as HTMLDetailsElement).open;
        } else if (el.classList.contains("techDetails")) {
          state.ui.techDetailsOpen = (el as HTMLDetailsElement).open;
        }
        schedulePluginResize();
      });
    });
}

const REPORT_THANKS_HTML =
  '<div class="reportThanksRow">' +
  '<button id="thanksBtn" type="button" class="thanksBtn">Спасибо, шайтан-машина!</button>' +
  "</div>";

function renderFixRow(
  fix: {
    ruleId: string;
    category: string;
    message: string;
    from: number;
    to: number;
    before: string;
    after: string;
    sourceText?: string;
  },
  sourceText: string,
  confirmActions?: { cardIdx: number; fixIdx: number },
): string {
  const actionsHtml = confirmActions
    ? `
      <div class="confirmActions">
        <button type="button" class="confirmApplyBtn" data-confirm-apply="${confirmActions.cardIdx}:${confirmActions.fixIdx}">
          Исправить
        </button>
        <button type="button" class="confirmSkipBtn" data-confirm-skip="${confirmActions.cardIdx}:${confirmActions.fixIdx}">
          Пропустить
        </button>
      </div>
    `
    : "";

  const wrapperClass = confirmActions ? "confirmFix" : "reportFix";
  const dataAttrs = confirmActions
    ? ` data-confirm-card="${confirmActions.cardIdx}" data-confirm-fix="${confirmActions.fixIdx}"`
    : "";

  return `
    <div class="${wrapperClass}"${dataAttrs}>
      <div class="reportWhy">${escapeHtml(fix.message)}</div>
      <div class="reportMeta">Правило: <code>${escapeHtml(fix.ruleId)}</code> · ${escapeHtml(formatFixCategoryLabel(fix.category, fix.ruleId))}</div>
      <div class="reportDiff">${formatFixDiffHtml(fix, sourceText)}</div>
      ${actionsHtml}
    </div>
  `;
}

function wrapReportInDetails(bodyHtml: string): string {
  return `
    <div class="reportBlock">
      <details class="reportDetails"${detailsOpenAttr(state.ui.reportDetailsOpen)}>
        <summary class="reportDetailsSummary">
          <span class="reportDetailsTitle">Что исправлено</span>
        </summary>
        <div class="reportDetailsBody">${bodyHtml}</div>
      </details>
    </div>
  `;
}

function renderResultHeaderHtml(): string {
  if (!state.summary) {
    return '<div class="resultWaiting">Шуршу по макету…</div>';
  }
  const applied = state.lastReport ? state.lastReport.summary.appliedFixCount : 0;
  const confirmCount = countConfirmFixes(state.confirmCards);
  return `
    <div class="resultHeader">
      <h1 class="resultTitle">Проверка окончена</h1>
      <div class="resultStats">
        <div class="resultStat">
          <div class="resultStatLabel">Проверено слоёв</div>
          <div class="resultStatValue">${state.summary.checkedLayers}</div>
        </div>
        <div class="resultStat">
          <div class="resultStatLabel">Исправлено</div>
          <div class="resultStatValue">${applied}</div>
        </div>
        <div class="resultStat">
          <div class="resultStatLabel">На подтверждение</div>
          <div class="resultStatValue">${confirmCount}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTechDetailsHtml(): string {
  const sl = state.sheetLoad;
  let bodyHtml = "";

  if (!sl) {
    bodyHtml = '<div class="empty" style="padding:4px 0">Статус загрузки словаря ещё не получен.</div>';
  } else if (sl.fromRemote && sl.ok) {
    bodyHtml = `<div class="sheetStatus ok">Словарь с GitHub: <b>${sl.ruleCount}</b> правил</div>`;
  } else if (!sl.ok) {
    bodyHtml = `<div class="sheetStatus err">GitHub недоступен — встроенный CSV (${sl.ruleCount} правил). ${escapeHtml(
      displayText(sl.errorMessage),
    )}</div>`;
  } else {
    bodyHtml = `<div class="sheetStatus ok">Встроенный CSV: <b>${sl.ruleCount}</b> правил</div>`;
  }

  return `
    <div class="techBlock">
      <details class="techDetails"${detailsOpenAttr(state.ui.techDetailsOpen)}>
        <summary>
          <span class="techDetailsTitle">Техническая хрень</span>
        </summary>
        <div class="techDetailsBody">${bodyHtml}</div>
      </details>
    </div>
  `;
}

function renderReportHtml(): string {
  const r = state.lastReport;
  if (!r) return "";
  if (!r.layers.length) {
    if (state.summary && state.summary.foundFixes === 0) {
      return '<div class="empty" style="padding:4px 0;margin-bottom:14px">В выделенных слоях правок нет</div>';
    }
    return "";
  }

  const layerBlocks = r.layers
    .map((layer) => {
      const fixesHtml = layer.fixes
        .map((f) =>
          renderFixRow(
            {
              ruleId: f.ruleId,
              category: f.category,
              message: f.message,
              from: f.from,
              to: f.to,
              before: f.before,
              after: f.after,
              sourceText: f.sourceText,
            },
            f.sourceText ?? "",
          ),
        )
        .join("");
      return `
        <div class="reportLayer">
          <div class="reportLayerTitle" data-node-id="${escapeHtml(layer.nodeId)}">${escapeHtml(
            layer.nodeName || "Без имени",
          )}</div>
          ${fixesHtml}
        </div>
      `;
    })
    .join("");

  return wrapReportInDetails(layerBlocks);
}

function renderConfirmHtml(): string {
  if (!state.confirmCards.length) return "";
  const layerBlocks = state.confirmCards
    .map((layer, cardIdx) => {
      const fixesHtml = layer.fixes
        .map((f, fixIdx) => {
          const ruleId = f.rule?.id ?? "";
          const category = f.rule?.category ?? "";
          const message = f.rule?.message ?? "";
          return renderFixRow(
            {
              ruleId,
              category,
              message,
              from: f.from,
              to: f.to,
              before: f.before,
              after: f.after,
            },
            layer.originalText,
            { cardIdx, fixIdx },
          );
        })
        .join("");
      return `
        <div class="reportLayer">
          <div class="reportLayerTitle" data-node-id="${escapeHtml(layer.nodeId)}">${escapeHtml(
            layer.nodeName || "Без имени",
          )}</div>
          ${fixesHtml}
        </div>
      `;
    })
    .join("");

  return `
    <div class="confirmBlock">
      <details class="confirmDetails"${detailsOpenAttr(state.ui.confirmDetailsOpen)}>
        <summary class="confirmDetailsSummary">
          <span class="confirmDetailsTitle">Требуют подтверждения</span>
        </summary>
        <div class="confirmDetailsBody">${layerBlocks}</div>
      </details>
    </div>
  `;
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

function wireConfirmButtons(): void {
  document.querySelectorAll("[data-confirm-apply]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = el.getAttribute("data-confirm-apply");
      if (!key) return;
      const parts = key.split(":");
      const cardIdx = Number(parts[0]);
      const fixIdx = Number(parts[1]);
      const card = state.confirmCards[cardIdx];
      if (!card) return;
      const fix = card.fixes[fixIdx];
      if (!fix) return;
      state.ui.confirmDetailsOpen = true;
      sendToPlugin({
        type: "ui:applyConfirmFix",
        nodeId: card.nodeId,
        fix: fix as TextFixDto,
      });
    });
  });
  document.querySelectorAll("[data-confirm-skip]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = el.getAttribute("data-confirm-skip");
      if (!key) return;
      const parts = key.split(":");
      skipConfirmFix(Number(parts[0]), Number(parts[1]));
    });
  });
}

function wireButtons(): void {
  const thanksBtn = document.getElementById("thanksBtn");
  if (thanksBtn) {
    thanksBtn.onclick = () => sendToPlugin({ type: "ui:close" });
  }
}

function wireReportLayerClicks(): void {
  document.querySelectorAll(".reportLayerTitle[data-node-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const nodeId = el.getAttribute("data-node-id");
      if (!nodeId) return;
      sendToPlugin({ type: "ui:focusLayer", nodeId });
    });
  });
}

function wireCardClicks(): void {
  document.querySelectorAll(".card[data-node-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const nodeId = el.getAttribute("data-node-id");
      if (!nodeId) return;
      sendToPlugin({ type: "ui:focusLayer", nodeId });
    });
  });
}

function render(): void {
  const app = document.getElementById("app");
  if (!app) return;

  captureUiAccordionState();

  const resultHeaderHtml = renderResultHeaderHtml();
  const confirmHtml = renderConfirmHtml();
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
        ${confirmHtml}
        ${thanksHtml}
        ${
          state.cards.length
            ? `<div class="sectionTitle">Оставшиеся совпадения (если есть)</div><div class="cards">${bodyHtml}</div>`
            : ""
        }
      </div>
      ${techDetailsHtml}
    </div>
  `;

  wireButtons();
  wireConfirmButtons();
  wireReportLayerClicks();
  wireCardClicks();
  wireAccordionResize();
  schedulePluginResize();
}

window.addEventListener("message", (event) => {
  const msg = event.data && (event.data as { pluginMessage?: PluginToUiMessage }).pluginMessage;
  if (!msg) return;

  if (msg.type === "plugin:error") {
    state.summary = null;
    state.lastReport = null;
    state.cards = [];
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML =
        '<div style="color:#b00020;padding:12px"><b>Ошибка плагина</b><br>' +
        escapeHtml(msg.message || "Неизвестная ошибка") +
        "</div>";
    }
    return;
  }

  if (msg.type === "plugin:config") {
    state.sheetLoad = msg.sheetLoad != null ? msg.sheetLoad : null;
    render();
    return;
  }

  if (msg.type === "plugin:checkResult") {
    state.summary = msg.result.summary;
    state.lastReport = msg.result.lastAutoApplyReport != null ? msg.result.lastAutoApplyReport : null;
    state.cards = msg.result.cards.map((c) => ({
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      originalText: c.originalText,
      previewText: c.previewText,
      fixes: c.fixes,
    }));
    state.confirmCards = (msg.result.confirmCards || []).map((c) => ({
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      originalText: c.originalText,
      previewText: c.previewText,
      fixes: c.fixes,
    }));
    render();
  }
});

sendToPlugin({ type: "ui:ready" });
render();
