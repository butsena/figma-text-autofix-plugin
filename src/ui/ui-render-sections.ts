import { escapeHtml } from "../shared/escape-html";
import type { AutoApplyFixLineDto } from "../shared/messages";
import {
  countConfirmFixes,
  detailsOpenAttr,
  formatLayerTitleHtml,
  formatTextLayersBlockHtml,
  layerDisplayLabel,
} from "./ui-helpers";
import { formatTechLexiconStatusBodyHtml } from "./ui-lexicon-status";
import { isNbspGlueFix, renderNbspGlueSummaryHtml } from "./nbsp-glue-summary";
import { state } from "./ui-state";
import { renderChoiceFixRow, renderFixRow } from "./ui-render-fix-row";

function layerSourceText(layer: {
  originalText?: string;
  fixes?: Array<{ sourceText?: string }>;
}): string | undefined {
  if (layer.originalText != null) return layer.originalText;
  return layer.fixes?.find((fix) => fix.sourceText != null)?.sourceText;
}

function renderLayerBlocksHtml<
  T extends {
    nodeId: string;
    nodeName: string;
    characterCount: number;
    frameName?: string;
    originalText?: string;
    fixes?: Array<{ sourceText?: string }>;
  },
>(layers: T[], renderFixes: (layer: T, cardIdx: number) => string): string {
  return layers
    .map(
      (layer, cardIdx) => `
        <div class="reportLayer">
          ${formatLayerTitleHtml(
            layer.nodeId,
            layerDisplayLabel({
              nodeName: layer.nodeName,
              text: layerSourceText(layer),
              frameName: layer.frameName,
            }),
            layer.characterCount,
          )}
          ${renderFixes(layer, cardIdx)}
        </div>
      `,
    )
    .join("");
}

function wrapReportInDetails(
  bodyHtml: string,
  options: { title: string; detailsClass: string; open: boolean },
): string {
  return `
    <div class="reportBlock">
      <details class="${options.detailsClass}"${detailsOpenAttr(options.open)}>
        <summary class="reportDetailsSummary">
          <span class="reportDetailsTitle">${options.title}</span>
        </summary>
        <div class="reportDetailsBody">${bodyHtml}</div>
      </details>
    </div>
  `;
}

function renderFixLineHtml(f: AutoApplyFixLineDto): string {
  return renderFixRow(
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
  );
}

function renderLayerFixesHtml(
  fixes: AutoApplyFixLineDto[],
  collapseNbspGlues: boolean,
): string {
  if (!collapseNbspGlues || !fixes.some(isNbspGlueFix)) {
    return fixes.map(renderFixLineHtml).join("");
  }

  const parts: string[] = [];
  let summaryEmitted = false;
  for (const fix of fixes) {
    if (isNbspGlueFix(fix)) {
      if (!summaryEmitted) {
        parts.push(renderNbspGlueSummaryHtml(fixes));
        summaryEmitted = true;
      }
      continue;
    }
    parts.push(renderFixLineHtml(fix));
  }
  return parts.join("");
}

function renderReportLayersHtml(
  report: NonNullable<typeof state.lastReport>,
  collapseNbspGlues: boolean,
): string {
  return renderLayerBlocksHtml(report.layers, (layer) =>
    renderLayerFixesHtml(layer.fixes, collapseNbspGlues),
  );
}

export function renderResultHeaderHtml(): string {
  if (state.spellcheckInProgress) return "";
  if (!state.summary) {
    return '<div class="resultWaiting">Шуршу по макету…</div>';
  }
  const appliedAuto = state.lastReport ? state.lastReport.summary.appliedFixCount : 0;
  const appliedManual = state.lastManualReport
    ? state.lastManualReport.summary.appliedFixCount
    : 0;
  const applied = appliedAuto + appliedManual;
  const pendingCount =
    countConfirmFixes(state.confirmCards) + countConfirmFixes(state.choiceCards);
  return `
    <div class="resultHeader">
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

/** После отчёта / «правок нет»: опциональный следующий шаг, не в шапке. */
export function renderSpellcheckActionHtml(): string {
  if (state.spellcheckInProgress || !state.summary || state.spellcheckEnabled) return "";
  return `
    <div class="spellcheckActionRow">
      <button id="spellcheckBtn" type="button" class="spellcheckBtn">Проверить орфографию</button>
    </div>
  `;
}

const REPORT_THANKS_HTML =
  '<div class="reportThanksRow">' +
  '<button id="thanksBtn" type="button" class="thanksBtn">Спасибо, шайтан-машина!</button>' +
  "</div>";

/** «Спасибо» — закрыть плагин. Пока Hunspell не доехал, кнопки нет: иначе кажется, что проверка кончилась. */
export function renderReportThanksHtml(): string {
  if (!state.summary || state.spellcheckInProgress) return "";
  return REPORT_THANKS_HTML;
}

export function renderSpellcheckStatusHtml(): string {
  if (!state.spellcheckInProgress) return "";
  return `
    <div class="spellcheckStatus" role="status" aria-live="polite">
      <span class="spellcheckSpinner" aria-hidden="true"></span>
      <span class="spellcheckStatusText">Проверяю орфографию — пажжите...</span>
    </div>
  `;
}

export function renderTextLayersHtml(): string {
  if (state.spellcheckInProgress) return "";
  return formatTextLayersBlockHtml(state.checkedTextLayers);
}

export function renderTechDetailsHtml(): string {
  if (state.spellcheckInProgress) return "";
  const lex = state.lexiconLoad;
  let bodyHtml = "";

  if (!lex) {
    bodyHtml = '<div class="empty" style="padding:4px 0">Статус загрузки словаря ещё не получен.</div>';
  } else {
    bodyHtml = formatTechLexiconStatusBodyHtml(lex, state.spellcheckEnabled);
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

function hasVisibleFixesOutsideAutoReport(): boolean {
  return (
    state.confirmCards.length > 0 ||
    state.choiceCards.length > 0 ||
    state.cards.length > 0 ||
    (state.lastManualReport?.layers.length ?? 0) > 0
  );
}

export function renderReportHtml(): string {
  if (state.spellcheckInProgress) return "";
  const r = state.lastReport;
  if (!r) return "";
  if (!r.layers.length) {
    if (
      state.summary &&
      state.summary.foundFixes === 0 &&
      !hasVisibleFixesOutsideAutoReport()
    ) {
      return '<div class="empty" style="padding:4px 0;margin-bottom:14px">В выделенных слоях правок нет</div>';
    }
    return "";
  }

  return wrapReportInDetails(renderReportLayersHtml(r, true), {
    title: "Исправлено автоматически",
    detailsClass: "reportDetails",
    open: state.ui.reportDetailsOpen,
  });
}

export function renderManualReportHtml(): string {
  if (state.spellcheckInProgress) return "";
  const r = state.lastManualReport;
  if (!r?.layers.length) return "";

  return wrapReportInDetails(renderReportLayersHtml(r, false), {
    title: "Вы исправили",
    detailsClass: "manualReportDetails",
    open: state.ui.manualReportDetailsOpen,
  });
}

export function renderConfirmHtml(): string {
  if (state.spellcheckInProgress) return "";
  if (!state.confirmCards.length) return "";
  const layerBlocks = renderLayerBlocksHtml(state.confirmCards, (layer, cardIdx) =>
    layer.fixes
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
      .join(""),
  );

  return `
    <div class="confirmBlock">
      <details class="confirmDetails"${detailsOpenAttr(state.ui.confirmDetailsOpen)}>
        <summary class="confirmDetailsSummary">
          <span class="confirmDetailsTitle">Обратите внимание</span>
        </summary>
        <div class="confirmDetailsBody">${layerBlocks}</div>
      </details>
    </div>
  `;
}

export function renderLeftoverCardsHtml(): string {
  if (state.spellcheckInProgress || !state.cards.length) return "";
  const bodyHtml = state.cards
    .map(
      (c) => `
          <div class="card cardClickable" data-node-id="${escapeHtml(c.nodeId)}">
            <div class="cardTitle">${escapeHtml(c.nodeName || "Без имени")}</div>
            <div class="fieldLabel">Текст слоя сейчас</div>
            <div class="textPreview">${escapeHtml(c.originalText)}</div>
            <div class="fieldLabel" style="color:#888;font-size:11px">Если снова нужны правки — измените текст или выделение и снова запустите плагин.</div>
          </div>
        `,
    )
    .join("");
  return `<div class="sectionTitle">Оставшиеся совпадения (если есть)</div><div class="cards">${bodyHtml}</div>`;
}

export function renderChoiceHtml(): string {
  if (state.spellcheckInProgress) return "";
  if (!state.choiceCards.length) return "";
  const layerBlocks = renderLayerBlocksHtml(state.choiceCards, (layer, cardIdx) =>
    layer.fixes
      .map((f, fixIdx) => renderChoiceFixRow(f, cardIdx, fixIdx, layer.originalText))
      .join(""),
  );

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
