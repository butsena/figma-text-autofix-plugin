import { escapeHtml } from "../shared/escape-html";

function isGroupingSpaceChar(ch: string, code: number): boolean {
  return ch === " " || code === 0x00a0 || code === 0x202f;
}

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

export function isWhitespaceOnlyFragment(text: string | null | undefined): boolean {
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

export { isGroupingSpaceChar };
