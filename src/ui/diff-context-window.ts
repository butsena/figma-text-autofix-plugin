import { visualizeDiffFragment } from "./diff-visualize";

const CONTEXT_WORD_LIMIT = 4;

export function isContextSpace(text: string, index: number): boolean {
  const ch = text.charAt(index);
  const code = text.charCodeAt(index);
  return ch === " " || ch === "\n" || ch === "\t" || ch === "\r" || code === 0x00a0 || code === 0x202f;
}

function isWhitespaceSpan(text: string): boolean {
  if (text.length === 0) return true;
  for (let i = 0; i < text.length; i++) {
    if (!isContextSpace(text, i)) return false;
  }
  return true;
}

/** Слова, которые правка задевает. Пробел между словами остаётся границей, не «словом». */
function anchorBounds(text: string, from: number, to: number): { start: number; end: number } {
  const end = Math.max(to, from);
  if (isWhitespaceSpan(text.slice(from, end))) return { start: from, end };
  let start = from;
  while (start > 0 && !isContextSpace(text, start - 1)) start--;
  let anchorEnd = end;
  while (anchorEnd < text.length && !isContextSpace(text, anchorEnd)) anchorEnd++;
  return { start, end: anchorEnd };
}

function takeWordsBefore(
  text: string,
  index: number,
  maxWords: number,
): { text: string; truncated: boolean } {
  let i = index;
  let words = 0;
  let start = index;
  while (i > 0 && words < maxWords) {
    let j = i - 1;
    while (j >= 0 && isContextSpace(text, j)) j--;
    if (j < 0) {
      start = 0;
      break;
    }
    let k = j;
    while (k >= 0 && !isContextSpace(text, k)) k--;
    words++;
    start = k + 1;
    i = start;
  }
  let truncated = false;
  if (words >= maxWords) {
    let j = start - 1;
    while (j >= 0 && isContextSpace(text, j)) j--;
    truncated = j >= 0;
  }
  return { text: text.slice(start, index), truncated };
}

function takeWordsAfter(
  text: string,
  index: number,
  maxWords: number,
): { text: string; truncated: boolean } {
  let i = index;
  let words = 0;
  const n = text.length;
  while (i < n && words < maxWords) {
    let j = i;
    while (j < n && isContextSpace(text, j)) j++;
    if (j >= n) {
      i = n;
      break;
    }
    let k = j;
    while (k < n && !isContextSpace(text, k)) k++;
    words++;
    i = k;
  }
  let truncated = false;
  if (words >= maxWords) {
    let j = i;
    while (j < n && isContextSpace(text, j)) j++;
    truncated = j < n;
  }
  return { text: text.slice(index, i), truncated };
}

function contextChunkHtml(chunk: { text: string; truncated: boolean }, edge: "left" | "right"): string {
  const body = chunk.text ? visualizeDiffFragment(chunk.text) : "";
  if (!chunk.truncated) return body;
  const mark = '<span class="reportCtxEllipsis">…</span>';
  return edge === "left" ? mark + body : body + mark;
}

type WordWindow = {
  left: { text: string; truncated: boolean };
  right: { text: string; truncated: boolean };
  mid: string;
};

/** Слова слева/справа от якоря правки и сам фрагмент [from, to). */
function wordWindowAround(sourceText: string, from: number, to: number): WordWindow {
  const anchor = anchorBounds(sourceText, from, to);
  return {
    left: takeWordsBefore(sourceText, anchor.start, CONTEXT_WORD_LIMIT),
    right: takeWordsAfter(sourceText, anchor.end, CONTEXT_WORD_LIMIT),
    mid: sourceText.slice(from, Math.max(to, from)),
  };
}

/** 3–5 слов вокруг правки. Короткий слой целиком, без «…». */
export function applyOutsideContext(
  diffHtml: string,
  sourceText: string,
  from: number,
  to: number,
): string {
  const { left, right } = wordWindowAround(sourceText, from, to);
  const leftHtml = contextChunkHtml(left, "left");
  const rightHtml = contextChunkHtml(right, "right");
  if (!leftHtml && !rightHtml) return diffHtml;
  const arrow = ' <span style="color:#888;font-weight:400">→</span> ';
  const idx = diffHtml.indexOf(arrow);
  if (idx < 0) return leftHtml + diffHtml + rightHtml;
  return (
    leftHtml +
    diffHtml.slice(0, idx) +
    arrow +
    leftHtml +
    diffHtml.slice(idx + arrow.length) +
    rightHtml
  );
}

/** Choice / орфография: текущее слово жирным, вокруг окно, без стрелки. */
export function formatAnchorContextHtml(sourceText: string, from: number, to: number): string {
  const { left, right, mid } = wordWindowAround(sourceText, from, to);
  return (
    contextChunkHtml(left, "left") +
    "<b>" +
    visualizeDiffFragment(mid) +
    "</b>" +
    contextChunkHtml(right, "right")
  );
}

function formatContextSide(
  leftWord: string,
  fragment: string | undefined,
  rightWord: string,
  bold: boolean,
): string {
  const parts: string[] = [];
  if (leftWord) {
    parts.push('<span class="reportCtxWord">' + visualizeDiffFragment(leftWord) + "</span>");
  }
  parts.push(
    bold ? "<b>" + visualizeDiffFragment(fragment) + "</b>" : visualizeDiffFragment(fragment),
  );
  if (rightWord) {
    parts.push('<span class="reportCtxWord">' + visualizeDiffFragment(rightWord) + "</span>");
  }
  return parts.join(" ");
}

export function formatContextualWhitespaceDiff(
  sourceText: string,
  from: number,
  to: number,
  before: string | undefined,
  after: string | undefined,
): string | null {
  const left = takeWordsBefore(sourceText, from, CONTEXT_WORD_LIMIT);
  const right = takeWordsAfter(sourceText, to, CONTEXT_WORD_LIMIT);
  const leftWord = left.text.trim();
  const rightWord = right.text.trim();
  if (!leftWord && !rightWord) return null;
  const leftMark = left.truncated ? '<span class="reportCtxEllipsis">…</span> ' : "";
  const rightMark = right.truncated ? ' <span class="reportCtxEllipsis">…</span>' : "";
  return (
    leftMark +
    formatContextSide(leftWord, before, rightWord, false) +
    rightMark +
    ' <span style="color:#888;font-weight:400">→</span> ' +
    leftMark +
    formatContextSide(leftWord, after, rightWord, true) +
    rightMark
  );
}
