import { escapeHtml } from "../shared/escape-html";
import { MSG_TYPO_NBSP_SUMMARY } from "../rules/rule-messages";
import type { AutoApplyFixLineDto } from "../shared/messages";

const NBSP = "\u00a0";
const NNBSP = "\u202f";

export type NbspGlueFix = Pick<AutoApplyFixLineDto, "from" | "to" | "before" | "after" | "sourceText">;

/** Пробел (или пусто) стал только неразрывным: не схлопывание, не перенос, не тире. */
export function isNbspGlueFix(fix: { before: string; after: string }): boolean {
  if (!fix.after) return false;
  for (let i = 0; i < fix.after.length; i++) {
    const ch = fix.after.charAt(i);
    if (ch !== NBSP && ch !== NNBSP) return false;
  }
  if (fix.before.length === 0) return true;
  if (fix.before.length > 1) return false;
  return fix.before === " ";
}

export function countNbspGlues<T extends { before: string; after: string }>(fixes: T[]): number {
  return fixes.filter(isNbspGlueFix).length;
}

function applyReportedFixes(text: string, fixes: NbspGlueFix[]): string {
  const ordered = [...fixes].sort((a, b) => b.from - a.from || b.to - a.to);
  let out = text;
  for (const fix of ordered) {
    if (out.slice(fix.from, fix.to) !== fix.before) continue;
    out = out.slice(0, fix.from) + fix.after + out.slice(fix.to);
  }
  return out;
}

export function formatNbspSentenceHtml(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const code = text.charCodeAt(i);
    if (code === 0x00a0) {
      out += '<span class="ws-mark ws-nbsp" title="неразрывный пробел (U+00A0)">□</span>';
    } else if (code === 0x202f) {
      out += '<span class="ws-mark ws-nnbsp" title="узкий неразрывный пробел (U+202F)">▫</span>';
    } else if (ch === "\n") {
      out += '<span class="ws-mark ws-nl" title="перевод строки (U+000A)">↵</span>\n';
    } else {
      out += escapeHtml(ch);
    }
  }
  return out;
}

function glueCountLabel(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} склейка в этом слое`;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return `${n} склейки в этом слое`;
  return `${n} склеек в этом слое`;
}

export function renderNbspGlueSummaryHtml(layerFixes: NbspGlueFix[]): string {
  const glues = layerFixes.filter(isNbspGlueFix);
  if (!glues.length) return "";
  const sourceText = layerFixes.find((f) => f.sourceText)?.sourceText ?? glues[0]?.sourceText ?? "";
  const result = applyReportedFixes(sourceText, layerFixes);
  return `
    <div class="reportFix">
      <div class="reportWhy">${escapeHtml(MSG_TYPO_NBSP_SUMMARY)}</div>
      <div class="reportMeta">${escapeHtml(glueCountLabel(glues.length))}</div>
      <div class="reportNbspSentence">${formatNbspSentenceHtml(result)}</div>
    </div>
  `;
}
