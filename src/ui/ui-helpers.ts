import { getAmbiguousFormChoice, isChoiceRuleWithoutSkip } from "../rules/choice/ambiguous-form-rules";
import { capitalizeLike } from "../shared/case";
import { formatCharacterCountLabel } from "../shared/text-char-count";

export { capitalizeLike };

export { isChoiceRuleWithoutSkip };

export function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function displayText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function countConfirmFixes(
  confirmCards: Array<{ fixes?: unknown[] }>,
): number {
  return confirmCards.reduce((n, card) => n + (card.fixes ? card.fixes.length : 0), 0);
}

export function formatChoiceHintHtml(ruleId: string, fallbackHint?: string): string {
  const choice = getAmbiguousFormChoice(ruleId);
  if (choice?.hintHtml) return choice.hintHtml;

  const hint = choice?.hint ?? fallbackHint;
  if (!hint) return "";

  if (ruleId === "cian-choice-vse-vsyo") {
    return `<div class="reportHint"><span class="reportHintTitle">Подсказка:</span> ${escapeHtml(hint)}</div>`;
  }

  return `<div class="reportHint">${escapeHtml(hint)}</div>`;
}

export function detailsOpenAttr(isOpen: boolean): string {
  return isOpen ? " open" : "";
}

/** Заголовок текстового слоя в отчёте: имя + счётчик символов. */
export function formatLayerTitleHtml(
  nodeId: string,
  nodeName: string,
  characterCount?: number,
): string {
  const name = escapeHtml(nodeName || "Без имени");
  const meta =
    characterCount != null
      ? `<span class="reportLayerMeta">${escapeHtml(formatCharacterCountLabel(characterCount))}</span>`
      : "";
  return `<div class="reportLayerTitle" data-node-id="${escapeHtml(nodeId)}">${name}${
    meta ? ` ${meta}` : ""
  }</div>`;
}

export function formatTextLayersBlockHtml(
  layers: Array<{ nodeId: string; nodeName: string; characterCount: number }>,
  detailsOpen: boolean,
): string {
  if (!layers.length) return "";
  const rows = layers
    .map(
      (layer) =>
        `<div class="textLayerRow">${formatLayerTitleHtml(layer.nodeId, layer.nodeName, layer.characterCount)}</div>`,
    )
    .join("");
  return `
    <div class="textLayersBlock">
      <details class="textLayersDetails"${detailsOpenAttr(detailsOpen)}>
        <summary class="textLayersDetailsSummary">
          <span class="textLayersDetailsTitle">Счётчик символов</span>
        </summary>
        <div class="textLayersDetailsBody">${rows}</div>
      </details>
    </div>
  `;
}

const SENTENCE_PERIOD_RULE_IDS: Record<string, true> = {
  "cian-139-sentence-terminal-period": true,
  "cian-139a-implicit-sentence-period": true,
  "cian-139b-single-sentence-remove-period": true,
};

/** Человекочитаемая категория правки в отчёте UI. */
export function formatFixCategoryLabel(category: string, ruleId?: string): string {
  if (ruleId && SENTENCE_PERIOD_RULE_IDS[ruleId]) return "Редполитика";
  if (category === "cian_editorial") return "Редполитика";
  if (category === "form_choice") return "Выбор формы";
  return category;
}
