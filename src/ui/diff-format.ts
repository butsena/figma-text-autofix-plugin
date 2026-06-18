import { escapeHtml } from "./ui-helpers";

export type FixDiffInput = {
  ruleId?: string;
  from?: number;
  to?: number;
  before?: string;
  after?: string;
  sourceText?: string;
};

const SERVICE_WORD_NBSP_RULE_IDS: Record<string, true> = {
  "cian-095-nbsp-after-short-words-strict": true,
  "cian-097-nbsp-after-service-words-before-line-end": true,
  "cian-098-nbsp-after-service-words-newlines-before-text": true,
  "cian-099-nbsp-after-service-words-trailing-newlines-at-eof": true,
  "cian-101-nbsp-after-service-words-mixed-ws-before-text": true,
};

const SENTENCE_PERIOD_RULE_IDS: Record<string, true> = {
  "cian-139-sentence-terminal-period": true,
  "cian-139a-implicit-sentence-period": true,
  "cian-139b-single-sentence-remove-period": true,
};

const WORD_CHAR_RE = /[0-9A-Za-z\u0400-\u04FF\u0451\u0401]/;

/** Показать невидимые символы в фрагменте diff. */
export function visualizeDiffFragment(text: string | null | undefined): string {
  if (text == null) return '<span class="ws-empty">∅</span>';
  const s = String(text);
  if (s.length === 0) return '<span class="ws-empty">∅</span>';

  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    const code = s.charCodeAt(i);
    if (ch === "\n") {
      out += '<span class="ws-mark ws-nl" title="перевод строки (U+000A)">↵</span>\n';
    } else if (ch === "\t") {
      out += '<span class="ws-mark ws-tab" title="табуляция (U+0009)">⇥</span>';
    } else if (code === 0x00a0) {
      out += '<span class="ws-mark ws-nbsp" title="неразрывный пробел (U+00A0)">□</span>';
    } else if (code === 0x202f) {
      out += '<span class="ws-mark ws-nnbsp" title="узкий неразрывный пробел (U+202F)">▫</span>';
    } else if (ch === " ") {
      out += '<span class="ws-mark ws-sp" title="пробел (U+0020)">·</span>';
    } else {
      out += escapeHtml(ch);
    }
  }
  return out;
}

export function formatDiffHtml(before: string | undefined, after: string | undefined): string {
  return (
    visualizeDiffFragment(before) +
    ' <span style="color:#888;font-weight:400">→</span> <b>' +
    visualizeDiffFragment(after) +
    "</b>"
  );
}

function isWhitespaceOnlyFragment(text: string | null | undefined): boolean {
  if (text == null || text === "") return true;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const ch = s.charAt(i);
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r" && code !== 0x00a0 && code !== 0x202f) {
      return false;
    }
  }
  return true;
}

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

function formatContextSide(
  leftWord: string,
  fragment: string | undefined,
  rightWord: string,
  bold: boolean,
): string {
  const parts: string[] = [];
  if (leftWord) {
    parts.push('<span class="reportCtxWord">' + escapeHtml(leftWord) + "</span>");
  }
  parts.push(
    bold ? "<b>" + visualizeDiffFragment(fragment) + "</b>" : visualizeDiffFragment(fragment),
  );
  if (rightWord) {
    parts.push('<span class="reportCtxWord">' + escapeHtml(rightWord) + "</span>");
  }
  return parts.join(" ");
}

function formatContextualWhitespaceDiff(
  sourceText: string,
  from: number,
  to: number,
  before: string | undefined,
  after: string | undefined,
): string | null {
  const leftWord = extractContextWordBefore(sourceText, from);
  const rightWord = extractContextWordAfter(sourceText, to);
  if (!leftWord && !rightWord) return null;
  return (
    formatContextSide(leftWord, before, rightWord, false) +
    ' <span style="color:#888;font-weight:400">→</span> ' +
    formatContextSide(leftWord, after, rightWord, true)
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
    return (
      '<span class="reportCtxWord">' +
      escapeHtml(word) +
      "</span>" +
      ' <span style="color:#888;font-weight:400">→</span> <b>' +
      '<span class="reportCtxWord">' +
      escapeHtml(word + (after ?? "")) +
      "</span></b>"
    );
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
    if (periodDiff) return periodDiff;
  }

  if (
    enriched.ruleId &&
    SERVICE_WORD_NBSP_RULE_IDS[enriched.ruleId] &&
    isWhitespaceOnlyFragment(enriched.before) &&
    isWhitespaceOnlyFragment(enriched.after) &&
    enriched.sourceText &&
    enriched.from != null &&
    enriched.to != null
  ) {
    const contextual = formatContextualWhitespaceDiff(
      enriched.sourceText,
      enriched.from,
      enriched.to,
      enriched.before,
      enriched.after,
    );
    if (contextual) return contextual;
  }

  return formatDiffHtml(enriched.before, enriched.after);
}
