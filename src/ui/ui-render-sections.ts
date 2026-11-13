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
import { FIX_CARD_PAGE, FIX_ROW_PAGE, takeLayersByFixLimit } from "./list-window";
import { confirmGroupId, groupFixes } from "./fix-groups";
import { state } from "./ui-state";
import { renderChoiceFixRow, renderFixRow } from "./ui-render-fix-row";

function layerSourceText(layer: {
  originalText?: string;
  sourceText?: string;
  fixes?: Array<{ sourceText?: string }>;
}): string | undefined {
  if (layer.originalText != null) return layer.originalText;
  if (layer.sourceText != null) return layer.sourceText;
  return layer.fixes?.find((fix) => fix.sourceText != null)?.sourceText;
}

function renderLayerBlocksHtml<
  T extends {
    nodeId: string;
    nodeName: string;
    characterCount: number;
    frameName?: string;
    originalText?: string;
    sourceText?: string;
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

function renderFixLineHtml(f: AutoApplyFixLineDto, layerSource = ""): string {
  const source = f.sourceText ?? layerSource;
  return renderFixRow(
    {
      ruleId: f.ruleId,
      category: f.category,
      message: f.message,
      from: f.from,
      to: f.to,
      before: f.before,
      after: f.after,
      sourceText: source,
    },
    source,
  );
}

function renderLayerFixesHtml(
  fixes: AutoApplyFixLineDto[],
  collapseNbspGlues: boolean,
  layerSource = "",
): string {
  const line = (fix: AutoApplyFixLineDto) => renderFixLineHtml(fix, layerSource);
  if (!collapseNbspGlues || !fixes.some(isNbspGlueFix)) {
    return fixes.map(line).join("");
  }

  const parts: string[] = [];
  let summaryEmitted = false;
  for (const fix of fixes) {
    if (isNbspGlueFix(fix)) {
      if (!summaryEmitted) {
        parts.push(renderNbspGlueSummaryHtml(fixes, layerSource));
        summaryEmitted = true;
      }
      continue;
    }
    parts.push(line(fix));
  }
  return parts.join("");
}

function renderShowMoreButton(which: "report" | "manual"): string {
  return `<button type="button" class="showMoreBtn" data-show-more="${which}">Показать ещё</button>`;
}

function renderReportLayersHtml(
  report: NonNullable<typeof state.lastReport>,
  collapseNbspGlues: boolean,
  limit: number,
  more: "report" | "manual",
): string {
  const windowed = takeLayersByFixLimit(report.layers, limit);
  const blocks = renderLayerBlocksHtml(windowed.layers, (layer) =>
    renderLayerFixesHtml(layer.fixes, collapseNbspGlues, layer.sourceText ?? ""),
  );
  const button = windowed.shown < windowed.total ? renderShowMoreButton(more) : "";
  return `${blocks}${button}`;
}

function renderAutofixProgressHtml(): string {
  const progress = state.autofixProgress;
  if (!progress) return "";
  const label =
    progress.phase === "spell"
      ? "Обновляю словарь"
      : progress.phase === "lexicon"
        ? "Освежаю редполитику"
        : `Исправляю тексты — ${progress.applied}`;
  const ratio = progress.total > 0 ? Math.min(1, progress.applied / progress.total) : 0;
  const width = progress.total > 0 ? `${Math.round(ratio * 100)}%` : "35%";
  const counter = progress.total > 0 ? `${progress.applied} / ${progress.total}` : "";
  return `
    <div class="resultProgress">
      <div class="resultProgressLabel">${escapeHtml(label)}</div>
      <div class="resultProgressTrack" role="progressbar" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.applied}">
        <div class="resultProgressBar${progress.total > 0 ? "" : " resultProgressBarIndeterminate"}" style="width:${width}"></div>
      </div>
      ${counter ? `<div class="resultProgressCount">${escapeHtml(counter)}</div>` : ""}
    </div>
  `;
}

export function renderResultHeaderHtml(): string {
  if (state.spellcheckInProgress && state.summary) return "";
  if (!state.summary) {
    return `<div class="resultWaiting">Шуршу по макету…${renderAutofixProgressHtml()}</div>`;
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

  const body = state.ui.reportDetailsOpen
    ? renderReportLayersHtml(r, true, state.reportShown, "report")
    : "";
  return wrapReportInDetails(body, {
    title: "Исправлено автоматически",
    detailsClass: "reportDetails",
    open: state.ui.reportDetailsOpen,
  });
}

export function renderManualReportHtml(): string {
  if (state.spellcheckInProgress) return "";
  const r = state.lastManualReport;
  if (!r?.layers.length) return "";

  const body = state.ui.manualReportDetailsOpen
    ? renderReportLayersHtml(r, false, state.manualReportShown, "manual")
    : "";
  return wrapReportInDetails(body, {
    title: "Вы исправили",
    detailsClass: "manualReportDetails",
    open: state.ui.manualReportDetailsOpen,
  });
}

type GroupedFixEntry = {
  ruleId: string;
  message: string;
  nodeId: string;
  nodeName: string;
  characterCount: number;
  frameName?: string;
  originalText?: string;
  render: () => string;
};

function renderFixRemainderHtml(shown: number, total: number): string {
  if (shown >= total || total <= 0) return "";
  const width = Math.round((shown / total) * 100);
  return `
    <div class="fixRemainder">
      <div class="resultProgressTrack">
        <div class="resultProgressBar" style="width:${width}%"></div>
      </div>
      <div class="resultProgressCount">${shown} / ${total} кейсов</div>
    </div>
  `;
}

function renderGroupedFixesHtml(
  kind: "confirm" | "choice",
  entries: GroupedFixEntry[],
  groupIdOf: (ruleId: string) => string,
): string {
  const groups = groupFixes(entries, groupIdOf, () => false);
  let shown = 0;
  let total = 0;
  const rows: string[] = [];
  const moreButtons: string[] = [];
  for (const group of groups) {
    const key = `${kind}:${group.id}`;
    const limit = state.expandedGroups[key] ?? FIX_CARD_PAGE;
    const visible = group.entries.slice(0, limit);
    shown += visible.length;
    total += group.entries.length;
    rows.push(
      visible
        .map(
          (entry) => `
          <div class="reportLayer">
            ${formatLayerTitleHtml(
              entry.nodeId,
              layerDisplayLabel({
                nodeName: entry.nodeName,
                text: entry.originalText,
                frameName: entry.frameName,
              }),
              entry.characterCount,
            )}
            ${entry.render()}
          </div>
        `,
        )
        .join(""),
    );
    const hidden = group.entries.length - visible.length;
    if (hidden > 0) {
      moreButtons.push(
        `<button type="button" class="showMoreBtn" data-more-group="${escapeHtml(key)}">Показать ещё ${Math.min(FIX_CARD_PAGE, hidden)}</button>`,
      );
    }
  }
  return renderFixRemainderHtml(shown, total) + rows.join("") + moreButtons.join("");
}

export function renderConfirmHtml(): string {
  if (state.spellcheckInProgress) return "";
  if (!state.confirmCards.length) return "";
  const entries: GroupedFixEntry[] = [];
  if (state.ui.confirmDetailsOpen) {
    state.confirmCards.forEach((layer, cardIdx) => {
      layer.fixes.forEach((f, fixIdx) => {
        const ruleId = f.rule?.id ?? "";
        const message = f.rule?.message ?? "";
        entries.push({
          ruleId,
          message,
          nodeId: layer.nodeId,
          nodeName: layer.nodeName,
          characterCount: layer.characterCount,
          frameName: layer.frameName,
          originalText: layer.originalText,
          render: () =>
            renderFixRow(
              {
                ruleId,
                category: f.rule?.category ?? "",
                message,
                hint: f.rule?.hint,
                from: f.from,
                to: f.to,
                before: f.before,
                after: f.after,
              },
              layer.originalText,
              { cardIdx, fixIdx },
            ),
        });
      });
    });
  }
  const body = state.ui.confirmDetailsOpen
    ? renderGroupedFixesHtml("confirm", entries, confirmGroupId)
    : "";

  return `
    <div class="confirmBlock">
      <details class="confirmDetails"${detailsOpenAttr(state.ui.confirmDetailsOpen)}>
        <summary class="confirmDetailsSummary">
          <span class="confirmDetailsTitle">Обратите внимание</span>
        </summary>
        <div class="confirmDetailsBody">${body}</div>
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
  const entries: GroupedFixEntry[] = [];
  if (state.ui.choiceDetailsOpen) {
    state.choiceCards.forEach((layer, cardIdx) => {
      layer.fixes.forEach((f, fixIdx) => {
        entries.push({
          ruleId: f.rule?.id ?? "",
          message: f.rule?.message ?? "",
          nodeId: layer.nodeId,
          nodeName: layer.nodeName,
          characterCount: layer.characterCount,
          frameName: layer.frameName,
          originalText: layer.originalText,
          render: () => renderChoiceFixRow(f, cardIdx, fixIdx, layer.originalText),
        });
      });
    });
  }
  const body = state.ui.choiceDetailsOpen
    ? renderGroupedFixesHtml("choice", entries, (ruleId) => ruleId)
    : "";

  return `
    <div class="choiceBlock">
      <details class="choiceDetails"${detailsOpenAttr(state.ui.choiceDetailsOpen)}>
        <summary class="choiceDetailsSummary">
          <span class="choiceDetailsTitle">Выберите вариант</span>
        </summary>
        <div class="choiceDetailsBody">${body}</div>
      </details>
    </div>
  `;
}
