import { formatFixDiffHtml } from "./diff-format";
import {
  countConfirmFixes,
  detailsOpenAttr,
  escapeHtml,
  formatChoiceHintHtml,
  formatFixCategoryLabel,
  formatLayerTitleHtml,
  formatLexiconResourceStatusHtml,
  formatTextLayersBlockHtml,
  isChoiceRuleWithoutSkip,
} from "./ui-helpers";
import { schedulePluginResize } from "./ui-resize";
import { captureUiAccordionState, choiceSelectionKey, state } from "./ui-state";
import type { TextFixDto } from "../shared/messages";

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
    bodyHtml = [
      formatLexiconResourceStatusHtml(lex.replacements, {
        remoteOk: (count) => `Словарь замен с GitHub: <b>${count}</b> правил`,
        remoteErr: (count) => `GitHub недоступен — встроенный CSV (${count} правил).`,
        bundledOk: (count) => `Встроенный CSV: <b>${count}</b> правил`,
      }),
      formatLexiconResourceStatusHtml(lex.boundaryExceptions, {
        remoteOk: (count) => `Когда не нужна точка с GitHub: <b>${count}</b> фраз`,
        remoteErr: (count) => `Когда не нужна точка — встроенный список (${count} фраз).`,
        bundledOk: (count) => `Встроенный список «когда не нужна точка»: <b>${count}</b> фраз`,
      }),
      formatLexiconResourceStatusHtml(lex.ambiguousFormChoices, {
        remoteOk: (count) => `Формы сложных слов с GitHub: <b>${count}</b> пар`,
        remoteErr: (count) => `Формы сложных слов — встроенный список (${count} пар).`,
        bundledOk: (count) => `Встроенный список форм сложных слов: <b>${count}</b> пар`,
      }),
    ].join("");
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

function renderChoiceFixRow(fix: TextFixDto, cardIdx: number, fixIdx: number): string {
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
