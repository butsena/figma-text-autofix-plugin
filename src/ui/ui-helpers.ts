import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
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

  return `<div class="reportHint"><span class="reportHintTitle">Подсказка:</span> ${escapeHtml(hint)}</div>`;
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

type LexiconResourceStatusLabels = {
  remoteOkPrefix: string;
  bundledOkPrefix: string;
  errorPrefix: string;
  countLabel: string;
};

export function renderLexiconResourceStatusHtml(
  status: LexiconResourceLoadStatus | undefined,
  labels: LexiconResourceStatusLabels,
): string {
  if (!status) {
    return `<div class="sheetStatus err">${escapeHtml(labels.errorPrefix)}: статус не получен.</div>`;
  }

  const countHtml = `<b>${status.count}</b> ${labels.countLabel}`;
  if (status.fromRemote && status.ok) {
    return `<div class="sheetStatus ok">${escapeHtml(labels.remoteOkPrefix)}: ${countHtml}</div>`;
  }
  if (!status.ok) {
    return `<div class="sheetStatus err">${escapeHtml(labels.errorPrefix)} (${status.count} ${labels.countLabel}). ${escapeHtml(
      displayText(status.errorMessage),
    )}</div>`;
  }
  return `<div class="sheetStatus ok">${escapeHtml(labels.bundledOkPrefix)}: ${countHtml}</div>`;
}

/** HTML статусов подгрузки словарей для блока «Техническая хрень». */
export function renderTechDetailsBodyHtml(lex: LexiconLoadStatusDto): string {
  return [
    renderLexiconResourceStatusHtml(lex.replacements, {
      remoteOkPrefix: "Словарь замен (lexicon) с GitHub",
      bundledOkPrefix: "Встроенный CSV замен",
      errorPrefix: "Словарь замен — встроенный CSV",
      countLabel: "правил",
    }),
    renderLexiconResourceStatusHtml(lex.boundaryExceptions, {
      remoteOkPrefix: "Исключения границ (boundary-exceptions) с GitHub",
      bundledOkPrefix: "Встроенный список исключений границ",
      errorPrefix: "Исключения границ — встроенный список",
      countLabel: "фраз",
    }),
    renderLexiconResourceStatusHtml(lex.formChoices, {
      remoteOkPrefix: "Выбор формы (form-choices) с GitHub",
      bundledOkPrefix: "Встроенный список выбора формы",
      errorPrefix: "Выбор формы — встроенный список",
      countLabel: "пар",
    }),
    renderLexiconResourceStatusHtml(lex.spellDictionary, {
      remoteOkPrefix: "Hunspell ru_RU (spell-dictionary) с GitHub",
      bundledOkPrefix: "Встроенный Hunspell ru_RU",
      errorPrefix: "Hunspell — встроенный словарь",
      countLabel: "лемм",
    }),
    renderLexiconResourceStatusHtml(lex.spellSupplement, {
      remoteOkPrefix: "Доп. слова орфографии (spell-dictionary) с GitHub",
      bundledOkPrefix: "Встроенный доп. словарь орфографии",
      errorPrefix: "Доп. слова орфографии — встроенный список",
      countLabel: "слов",
    }),
    renderLexiconResourceStatusHtml(lex.spellWhitelist, {
      remoteOkPrefix: "Whitelist орфографии (spell-dictionary) с GitHub",
      bundledOkPrefix: "Встроенный whitelist орфографии",
      errorPrefix: "Whitelist орфографии — встроенный список",
      countLabel: "слов",
    }),
  ].join("");
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
