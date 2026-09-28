import { escapeHtml } from "../shared/escape-html";
import {
  applyOutsideContext,
  formatContextualWhitespaceDiff,
  isContextSpace,
} from "./diff-context-window";
import {
  formatDiffHtml,
  isGroupingSpaceChar,
  isWhitespaceOnlyFragment,
  visualizeDiffFragment,
} from "./diff-visualize";

export type FixDiffInput = {
  ruleId?: string;
  from?: number;
  to?: number;
  before?: string;
  after?: string;
  sourceText?: string;
};

export { formatAnchorContextHtml } from "./diff-context-window";
export { formatDiffHtml, visualizeDiffFragment } from "./diff-visualize";

const LINE_BREAK_RULE_IDS: Record<string, true> = {
  "cian-121-remove-leading-line-breaks": true,
  "cian-121-remove-trailing-line-breaks": true,
  "cian-121-collapse-excess-line-breaks": true,
};

const SENTENCE_PERIOD_RULE_IDS: Record<string, true> = {
  "cian-139-sentence-terminal-period": true,
  "cian-139a-implicit-sentence-period": true,
  "cian-139b-single-sentence-remove-period": true,
};

const WORD_CHAR_RE = /[0-9A-Za-z\u0400-\u04FF\u0451\u0401]/;

/** Цифры и разделители разрядов слева от пробела. */
const NUMBER_CONTEXT_CHAR_RE = /[0-9.,]/;

/** Единицы измерения, валюта и символы справа от пробела. */
const UNIT_CONTEXT_CHAR_RE = /[0-9A-Za-z\u0400-\u04FF\u0451\u0401%°²³№§₽]/;

function isSentenceTerminalPunctuationFragment(text: string | null | undefined): boolean {
  if (text == null || text === "") return false;
  const s = String(text).trim();
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "…") {
      return false;
    }
  }
  return true;
}

function extractContextWordBefore(text: string, index: number): string {
  let i = index - 1;
  while (i >= 0 && WORD_CHAR_RE.test(text.charAt(i))) i--;
  return text.slice(i + 1, index);
}

function extractContextWordAfter(text: string, index: number): string {
  let i = index;
  while (i < text.length && WORD_CHAR_RE.test(text.charAt(i))) i++;
  return text.slice(index, i);
}

function extractNumberContextBefore(text: string, index: number): string {
  let i = index - 1;
  while (i >= 0) {
    const ch = text.charAt(i);
    const code = text.charCodeAt(i);
    if (NUMBER_CONTEXT_CHAR_RE.test(ch) || isGroupingSpaceChar(ch, code)) {
      i--;
      continue;
    }
    break;
  }
  return text.slice(i + 1, index);
}

function extractUnitContextAfter(text: string, index: number): string {
  let i = index;
  while (i < text.length && UNIT_CONTEXT_CHAR_RE.test(text.charAt(i))) i++;
  return text.slice(index, i);
}

function extractContextBefore(text: string, index: number): string {
  return extractNumberContextBefore(text, index) || extractContextWordBefore(text, index);
}

function extractContextAfter(text: string, index: number): string {
  return extractUnitContextAfter(text, index) || extractContextWordAfter(text, index);
}

function shouldShowContextualWhitespaceDiff(fix: FixDiffInput): boolean {
  if (!fix.sourceText) return false;
  if (!isWhitespaceOnlyFragment(fix.before) || !isWhitespaceOnlyFragment(fix.after)) return false;
  if (fix.ruleId && LINE_BREAK_RULE_IDS[fix.ruleId]) return false;
  if (fix.from == null || fix.to == null) return false;
  const left = extractContextBefore(fix.sourceText, fix.from);
  const right = extractContextAfter(fix.sourceText, fix.to);
  return Boolean(left || right);
}

function isLetterFragment(text: string | undefined): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    if (!WORD_CHAR_RE.test(text.charAt(i))) return false;
  }
  return true;
}

function isWordStartIndex(text: string, index: number): boolean {
  if (index <= 0) return true;
  return !WORD_CHAR_RE.test(text.charAt(index - 1));
}

function formatWordWithHighlightedPrefix(prefix: string, rest: string): string {
  return (
    '<span class="reportCtxWord"><b>' +
    visualizeDiffFragment(prefix) +
    "</b>" +
    visualizeDiffFragment(rest) +
    "</span>"
  );
}

function formatWordPrefixDiff(
  sourceText: string,
  from: number,
  to: number,
  before: string,
  after: string,
): string | null {
  if (!isLetterFragment(before) || !isLetterFragment(after)) return null;
  if (!isWordStartIndex(sourceText, from)) return null;
  const rest = extractContextWordAfter(sourceText, to);
  if (!rest) return null;
  return (
    formatWordWithHighlightedPrefix(before, rest) +
    ' <span style="color:#888;font-weight:400">→</span> ' +
    formatWordWithHighlightedPrefix(after, rest)
  );
}

function formatWordToWordWithPeriod(word: string, added: string): string {
  return (
    '<span class="reportCtxWord">' +
    escapeHtml(word) +
    "</span>" +
    ' <span style="color:#888;font-weight:400">→</span> <b>' +
    '<span class="reportCtxWord">' +
    escapeHtml(word + added) +
    "</span></b>"
  );
}

function formatSentencePeriodDiff(
  sourceText: string,
  from: number,
  before: string | undefined,
  after: string | undefined,
): string | null {
  if (isWhitespaceOnlyFragment(before) && isSentenceTerminalPunctuationFragment(after)) {
    const word = extractContextWordBefore(sourceText, from);
    if (!word) return null;
    return formatWordToWordWithPeriod(word, after ?? "");
  }

  if (
    before &&
    after &&
    after.startsWith(before) &&
    isLetterFragment(before) &&
    isSentenceTerminalPunctuationFragment(after.slice(before.length))
  ) {
    const word = extractContextWordBefore(sourceText, from) + before;
    return formatWordToWordWithPeriod(word, after.slice(before.length));
  }

  if (before?.endsWith(".") && (!after || after === "" || after === before.slice(0, -1))) {
    const periodAt = from + before.length - 1;
    const word = extractContextWordBefore(sourceText, periodAt);
    if (!word) return null;
    return (
      '<span class="reportCtxWord">' +
      escapeHtml(word + ".") +
      "</span>" +
      ' <span style="color:#888;font-weight:400">→</span> <b>' +
      '<span class="reportCtxWord">' +
      escapeHtml(word) +
      "</span></b>"
    );
  }

  return null;
}

export function formatFixDiffHtml(fix: FixDiffInput, sourceText?: string): string {
  const enriched = {
    ...fix,
    sourceText: sourceText != null ? sourceText : fix.sourceText,
  };

  if (enriched.ruleId && SENTENCE_PERIOD_RULE_IDS[enriched.ruleId] && enriched.sourceText) {
    const periodDiff = formatSentencePeriodDiff(
      enriched.sourceText,
      enriched.from ?? 0,
      enriched.before,
      enriched.after,
    );
    if (periodDiff) {
      const at = enriched.from ?? 0;
      let start = at;
      while (start > 0 && !isContextSpace(enriched.sourceText, start - 1)) start--;
      let end = at;
      while (end < enriched.sourceText.length && !isContextSpace(enriched.sourceText, end)) end++;
      return applyOutsideContext(periodDiff, enriched.sourceText, start, Math.max(end, at));
    }
  }

  if (shouldShowContextualWhitespaceDiff(enriched)) {
    const contextual = formatContextualWhitespaceDiff(
      enriched.sourceText!,
      enriched.from!,
      enriched.to!,
      enriched.before,
      enriched.after,
    );
    if (contextual) return contextual;
  }

  if (
    enriched.sourceText &&
    enriched.from != null &&
    enriched.to != null &&
    enriched.before != null &&
    enriched.after != null
  ) {
    const wordPrefix = formatWordPrefixDiff(
      enriched.sourceText,
      enriched.from,
      enriched.to,
      enriched.before,
      enriched.after,
    );
    if (wordPrefix) {
      return applyOutsideContext(wordPrefix, enriched.sourceText, enriched.from, enriched.to);
    }
  }

  const plain = formatDiffHtml(enriched.before, enriched.after);
  if (enriched.sourceText && enriched.from != null && enriched.to != null) {
    return applyOutsideContext(plain, enriched.sourceText, enriched.from, enriched.to);
  }
  return plain;
}
