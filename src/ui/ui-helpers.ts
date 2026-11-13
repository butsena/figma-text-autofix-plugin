import { getAmbiguousFormChoice } from "../lexicon/ambiguous-form-choices-store";
import { escapeHtml } from "../shared/escape-html";
import { formatCharacterCountLabel } from "../shared/text-char-count";

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

export function formatChoiceHintHtml(
  ruleId: string,
  fallbackHint?: string,
  hintHtmlFromFix?: string,
): string {
  if (hintHtmlFromFix) return hintHtmlFromFix;

  const plainHint = fallbackHint?.trim();
  if (plainHint) {
    return `<div class="reportHint"><span class="reportHintTitle">Подсказка:</span> ${escapeHtml(plainHint)}</div>`;
  }

  const choice = getAmbiguousFormChoice(ruleId);
  if (choice?.hintHtml) return choice.hintHtml;
  if (choice?.hint) {
    return `<div class="reportHint"><span class="reportHintTitle">Подсказка:</span> ${escapeHtml(choice.hint)}</div>`;
  }
  return "";
}

export function detailsOpenAttr(isOpen: boolean): string {
  return isOpen ? " open" : "";
}

/** До этой длины в строке показываем сам текст. Дальше — имя фрейма. */
export const LAYER_TEXT_LABEL_MAX = 25;

export function layerRowLabel(text: string, frameName: string): string {
  const frame = frameName.trim() || "Без имени";
  if (text.length > LAYER_TEXT_LABEL_MAX) return frame;
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine || frame;
}

export function layerDisplayLabel(input: {
  nodeName: string;
  text?: string;
  frameName?: string;
}): string {
  const frame = input.frameName?.trim() || input.nodeName.trim() || "Без имени";
  if (input.text == null) return frame;
  return layerRowLabel(input.text, frame);
}

/** Заголовок текстового слоя в отчёте: подпись + счётчик символов. */
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
  layers: Array<{
    nodeId: string;
    nodeName: string;
    characterCount: number;
    text?: string;
    frameName?: string;
  }>,
): string {
  if (!layers.length) return "";
  const rows = layers
    .map((layer) => {
      const label = escapeHtml(
        layerDisplayLabel({
          nodeName: layer.nodeName,
          text: layer.text,
          frameName: layer.frameName,
        }),
      );
      return `<div class="textLayerRow reportLayerTitle" data-node-id="${escapeHtml(layer.nodeId)}"><span class="textLayerLabel">${label}</span><span class="reportLayerMeta">${escapeHtml(formatCharacterCountLabel(layer.characterCount))}</span></div>`;
    })
    .join("");
  return `<div class="textLayersTable">${rows}</div>`;
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
