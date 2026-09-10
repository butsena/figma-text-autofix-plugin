import { escapeHtml } from "../shared/escape-html";
import { formatFixDiffHtml } from "./diff-format";
import { formatChoiceHintHtml, formatFixCategoryLabel } from "./ui-helpers";
import { selectedChoiceOptionIndex } from "./choice-selection";
import type { TextFixDto } from "../shared/messages";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";

export function renderFixRow(
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
  if (confirmActions && fix.ruleId === ORTHOGRAPHY_SPELL_RULE_ID) {
    return renderOrthographySpellFixRow(fix, confirmActions.cardIdx, confirmActions.fixIdx);
  }

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

/** Орфография: как choice-алерт, но с полем ввода вместо вариантов. */
export function renderOrthographySpellFixRow(
  fix: {
    ruleId: string;
    category: string;
    message: string;
    before: string;
    after: string;
  },
  cardIdx: number,
  fixIdx: number,
): string {
  const suggested = fix.after !== fix.before ? fix.after : "";
  const applyDisabled = !suggested ? " disabled" : "";

  return `
    <div class="confirmFix spellFix" data-confirm-card="${cardIdx}" data-confirm-fix="${fixIdx}">
      <div class="reportWhy">${escapeHtml(fix.message)}</div>
      <div class="reportMeta">Правило: <code>${escapeHtml(fix.ruleId)}</code> · ${escapeHtml(formatFixCategoryLabel(fix.category, fix.ruleId))}</div>
      <div class="reportDiff"><span class="reportCtxWord">${escapeHtml(fix.before)}</span></div>
      <label class="spellInputLabel" for="spell-input-${cardIdx}-${fixIdx}">Исправление</label>
      <input
        id="spell-input-${cardIdx}-${fixIdx}"
        type="text"
        class="spellInput"
        data-spell-input="${cardIdx}:${fixIdx}"
        value="${escapeHtml(suggested)}"
        placeholder="Введите правильное слово"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="confirmActions">
        <button type="button" class="confirmApplyBtn" data-spell-apply="${cardIdx}:${fixIdx}"${applyDisabled}>
          Исправить
        </button>
        <button type="button" class="confirmSkipBtn" data-spell-skip="${cardIdx}:${fixIdx}">
          Пропустить
        </button>
      </div>
    </div>
  `;
}

export function renderChoiceFixRow(fix: TextFixDto, cardIdx: number, fixIdx: number): string {
  const ruleId = fix.rule?.id ?? "";
  const category = fix.rule?.category ?? "";
  const message = fix.rule?.message ?? "";
  const options = fix.rule?.choiceOptions ?? [];
  const current = fix.before;
  const hintHtml = formatChoiceHintHtml(ruleId, fix.rule?.hint, fix.rule?.hintHtml);
  const selectedIdx = selectedChoiceOptionIndex(cardIdx, fixIdx, current, options);
  const optionsHtml = options
    .map((option, optionIdx) => {
      const cls =
        selectedIdx === optionIdx ? "choiceOptionBtn choiceOptionSelected" : "choiceOptionBtn";
      return `<button type="button" class="${cls}" data-choice-pick="${cardIdx}:${fixIdx}:${optionIdx}">${escapeHtml(option)}</button>`;
    })
    .join("");
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
      </div>
    </div>
  `;
}
