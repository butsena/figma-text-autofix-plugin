import { formatFixDiffHtml } from "./diff-format";
import {
  capitalizeLike,
  countConfirmFixes,
  detailsOpenAttr,
  displayText,
  escapeHtml,
  formatChoiceHintHtml,
  formatFixCategoryLabel,
  formatLayerTitleHtml,
  formatTextLayersBlockHtml,
  isChoiceRuleWithoutSkip,
} from "./ui-helpers";
import {
  PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MIN_HEIGHT,
  PLUGIN_UI_WIDTH,
} from "../shared/plugin-ui-layout";
import type {
  AutoApplyReportDto,
  CheckedTextLayerDto,
  PluginToUiMessage,
  LexiconLoadStatusDto,
  TextFixDto,
  TextNodeCardDto,
  UiToPluginMessage,
} from "../shared/messages";

type UiState = {
  summary: {
    checkedLayers: number;
    foundFixes: number;
    confirmFixes: number;
    choiceFixes: number;
  } | null;
  checkedTextLayers: CheckedTextLayerDto[];
  cards: TextNodeCardDto[];
  confirmCards: TextNodeCardDto[];
  choiceCards: TextNodeCardDto[];
  lastReport: AutoApplyReportDto | null;
  lexiconLoad: LexiconLoadStatusDto | null;
  ui: {
    confirmDetailsOpen: boolean;
    choiceDetailsOpen: boolean;
    reportDetailsOpen: boolean;
    textLayersDetailsOpen: boolean;
    techDetailsOpen: boolean;
  };
  /** Выбранный вариант choice-правки: ключ «cardIdx:fixIdx» → индекс опции. */
  choiceSelection: Record<string, number>;
};

const state: UiState = {
  summary: null,
  checkedTextLayers: [],
  cards: [],
  confirmCards: [],
  choiceCards: [],
  lastReport: null,
  lexiconLoad: null,
  ui: {
    confirmDetailsOpen: true,
    choiceDetailsOpen: true,
    reportDetailsOpen: false,
    textLayersDetailsOpen: false,
    techDetailsOpen: false,
  },
  choiceSelection: {},
};

function choiceSelectionKey(cardIdx: number, fixIdx: number): string {
  return `${cardIdx}:${fixIdx}`;
}

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
  const choiceEl = document.querySelector("details.choiceDetails");
  if (choiceEl instanceof HTMLDetailsElement) state.ui.choiceDetailsOpen = choiceEl.open;
  const reportEl = document.querySelector("details.reportDetails");
  if (reportEl instanceof HTMLDetailsElement) state.ui.reportDetailsOpen = reportEl.open;
  const textLayersEl = document.querySelector("details.textLayersDetails");
  if (textLayersEl instanceof HTMLDetailsElement) state.ui.textLayersDetailsOpen = textLayersEl.open;
  const techEl = document.querySelector("details.techDetails");
  if (techEl instanceof HTMLDetailsElement) state.ui.techDetailsOpen = techEl.open;
}

function wireAccordionResize(): void {
  document
    .querySelectorAll(
      "details.reportDetails, details.confirmDetails, details.choiceDetails, details.textLayersDetails, details.techDetails",
    )
    .forEach(function (el) {
      el.addEventListener("toggle", function () {
        if (el.classList.contains("confirmDetails")) {
          state.ui.confirmDetailsOpen = (el as HTMLDetailsElement).open;
        } else if (el.classList.contains("choiceDetails")) {
          state.ui.choiceDetailsOpen = (el as HTMLDetailsElement).open;
        } else if (el.classList.contains("reportDetails")) {
          state.ui.reportDetailsOpen = (el as HTMLDetailsElement).open;
        } else if (el.classList.contains("textLayersDetails")) {
          state.ui.textLayersDetailsOpen = (el as HTMLDetailsElement).open;
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
    hint?: string;
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

  const hintHtml = fix.hint
    ? `<div class="reportHint">${escapeHtml(fix.hint)}</div>`
    : "";

  return `
    <div class="${wrapperClass}"${dataAttrs}>
      <div class="reportWhy">${escapeHtml(fix.message)}</div>
      ${hintHtml}
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
  const pendingCount =
    countConfirmFixes(state.confirmCards) + countConfirmFixes(state.choiceCards);
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
          <div class="resultStatValue">${pendingCount}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTextLayersHtml(): string {
  return formatTextLayersBlockHtml(state.checkedTextLayers, state.ui.textLayersDetailsOpen);
}

function renderTechDetailsHtml(): string {
  const lex = state.lexiconLoad;
  let bodyHtml = "";

  if (!lex) {
    bodyHtml = '<div class="empty" style="padding:4px 0">Статус загрузки словаря ещё не получен.</div>';
  } else {
    const rep = lex.replacements;
    if (rep.fromRemote && rep.ok) {
      bodyHtml = `<div class="sheetStatus ok">Словарь замен с GitHub: <b>${rep.count}</b> правил</div>`;
    } else if (!rep.ok) {
      bodyHtml = `<div class="sheetStatus err">GitHub недоступен — встроенный CSV (${rep.count} правил). ${escapeHtml(
        displayText(rep.errorMessage),
      )}</div>`;
    } else {
      bodyHtml = `<div class="sheetStatus ok">Встроенный CSV: <b>${rep.count}</b> правил</div>`;
    }

    const boundary = lex.boundaryExceptions;
    if (boundary.fromRemote && boundary.ok) {
      bodyHtml += `<div class="sheetStatus ok">Исключения границ с GitHub: <b>${boundary.count}</b> фраз</div>`;
    } else if (!boundary.ok) {
      bodyHtml += `<div class="sheetStatus err">Исключения границ — встроенный список (${boundary.count} фраз). ${escapeHtml(
        displayText(boundary.errorMessage),
      )}</div>`;
    } else {
      bodyHtml += `<div class="sheetStatus ok">Встроенный список исключений: <b>${boundary.count}</b> фраз</div>`;
    }
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
          ${formatLayerTitleHtml(layer.nodeId, layer.nodeName, layer.characterCount)}
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
          const hint = f.rule?.hint;
          return renderFixRow(
            {
              ruleId,
              category,
              message,
              hint,
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
          ${formatLayerTitleHtml(layer.nodeId, layer.nodeName, layer.characterCount)}
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

function renderChoiceFixRow(
  fix: TextFixDto,
  cardIdx: number,
  fixIdx: number,
): string {
  const ruleId = fix.rule?.id ?? "";
  const category = fix.rule?.category ?? "";
  const message = fix.rule?.message ?? "";
  const options = fix.rule?.choiceOptions ?? [];
  const current = fix.before;
  const hintHtml = formatChoiceHintHtml(ruleId, fix.rule?.hint);
  const selectionKey = choiceSelectionKey(cardIdx, fixIdx);
  const selectedIdx = state.choiceSelection[selectionKey];
  const optionsHtml = options
    .map((option, optionIdx) => {
      const cls =
        selectedIdx === optionIdx ? "choiceOptionBtn choiceOptionSelected" : "choiceOptionBtn";
      return `<button type="button" class="${cls}" data-choice-pick="${cardIdx}:${fixIdx}:${optionIdx}">${escapeHtml(option)}</button>`;
    })
    .join("");
  const skipHtml = isChoiceRuleWithoutSkip(ruleId)
    ? ""
    : `<button type="button" class="confirmSkipBtn" data-choice-skip="${cardIdx}:${fixIdx}">Пропустить</button>`;
  const confirmDisabled = selectedIdx == null ? " disabled" : "";

  return `
    <div class="choiceFix" data-choice-card="${cardIdx}" data-choice-fix="${fixIdx}">
      <div class="reportWhy">${escapeHtml(message)}</div>
      ${hintHtml}
      <div class="reportMeta">Правило: <code>${escapeHtml(ruleId)}</code> · ${escapeHtml(formatFixCategoryLabel(category, ruleId))}</div>
      <div class="reportDiff"><span class="reportCtxWord">${escapeHtml(current)}</span></div>
      <div class="choiceActions">
        ${optionsHtml}
        <button type="button" class="choiceConfirmBtn" data-choice-confirm="${cardIdx}:${fixIdx}"${confirmDisabled}>Подтвердить</button>
        ${skipHtml}
      </div>
    </div>
  `;
}

function renderChoiceHtml(): string {
  if (!state.choiceCards.length) return "";
  const layerBlocks = state.choiceCards
    .map((layer, cardIdx) => {
      const fixesHtml = layer.fixes
        .map((f, fixIdx) => renderChoiceFixRow(f, cardIdx, fixIdx))
        .join("");
      return `
        <div class="reportLayer">
          ${formatLayerTitleHtml(layer.nodeId, layer.nodeName, layer.characterCount)}
          ${fixesHtml}
        </div>
      `;
    })
    .join("");

  return `
    <div class="choiceBlock">
      <details class="choiceDetails"${detailsOpenAttr(state.ui.choiceDetailsOpen)}>
        <summary class="choiceDetailsSummary">
          <span class="choiceDetailsTitle">Выберите вариант</span>
        </summary>
        <div class="choiceDetailsBody">${layerBlocks}</div>
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

function skipChoiceFix(cardIdx: number, fixIdx: number): void {
  const card = state.choiceCards[cardIdx];
  if (!card || !card.fixes[fixIdx]) return;
  delete state.choiceSelection[choiceSelectionKey(cardIdx, fixIdx)];
  card.fixes.splice(fixIdx, 1);
  if (card.fixes.length === 0) {
    state.choiceCards.splice(cardIdx, 1);
  }
  if (state.summary) {
    state.summary.choiceFixes = countConfirmFixes(state.choiceCards);
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
  const optionIdx = state.choiceSelection[selectionKey];
  const option = optionIdx != null ? fix.rule?.choiceOptions?.[optionIdx] : undefined;
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
        type: "ui:applyManualFix",
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

function wireChoiceButtons(): void {
  document.querySelectorAll("[data-choice-pick]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = el.getAttribute("data-choice-pick");
      if (!key) return;
      const parts = key.split(":");
      selectChoiceOption(Number(parts[0]), Number(parts[1]), Number(parts[2]));
    });
  });
  document.querySelectorAll("[data-choice-confirm]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if ((el as HTMLButtonElement).disabled) return;
      const key = el.getAttribute("data-choice-confirm");
      if (!key) return;
      const parts = key.split(":");
      confirmChoiceSelection(Number(parts[0]), Number(parts[1]));
    });
  });
  document.querySelectorAll("[data-choice-skip]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = el.getAttribute("data-choice-skip");
      if (!key) return;
      const parts = key.split(":");
      skipChoiceFix(Number(parts[0]), Number(parts[1]));
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

  wireButtons();
  wireConfirmButtons();
  wireChoiceButtons();
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
    state.checkedTextLayers = [];
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
    state.lexiconLoad = msg.lexiconLoad != null ? msg.lexiconLoad : null;
    render();
    return;
  }

  if (msg.type === "plugin:checkResult") {
    state.choiceSelection = {};
    state.summary = msg.result.summary;
    state.checkedTextLayers = msg.result.checkedTextLayers || [];
    state.lastReport = msg.result.lastAutoApplyReport != null ? msg.result.lastAutoApplyReport : null;
    state.cards = msg.result.cards.map((c) => ({
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      originalText: c.originalText,
      previewText: c.previewText,
      characterCount: c.characterCount,
      fixes: c.fixes,
    }));
    state.confirmCards = (msg.result.confirmCards || []).map((c) => ({
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      originalText: c.originalText,
      previewText: c.previewText,
      characterCount: c.characterCount,
      fixes: c.fixes,
    }));
    state.choiceCards = (msg.result.choiceCards || []).map((c) => ({
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      originalText: c.originalText,
      previewText: c.previewText,
      characterCount: c.characterCount,
      fixes: c.fixes,
    }));
    render();
  }
});

sendToPlugin({ type: "ui:ready" });
render();
