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

/**
 * Применяет правки с конца; индексы новых glue-NBSP — в координатах итогового текста.
 * Не-glue правки тоже применяются (бренд, тире), но в newGlueIndexes не попадают.
 */
export function applyReportedFixesWithNewGlueIndexes(
  text: string,
  fixes: NbspGlueFix[],
): { text: string; newGlueIndexes: Set<number> } {
  const ordered = [...fixes].sort((a, b) => b.from - a.from || b.to - a.to);
  let out = text;
  const newGlueIndexes = new Set<number>();

  for (const fix of ordered) {
    if (out.slice(fix.from, fix.to) !== fix.before) continue;
    const oldTo = fix.to;
    const delta = fix.after.length - (oldTo - fix.from);
    out = out.slice(0, fix.from) + fix.after + out.slice(oldTo);

    if (delta !== 0 && newGlueIndexes.size > 0) {
      const shifted = new Set<number>();
      for (const idx of newGlueIndexes) {
        if (idx >= oldTo) shifted.add(idx + delta);
        else if (idx < fix.from) shifted.add(idx);
      }
      newGlueIndexes.clear();
      for (const idx of shifted) newGlueIndexes.add(idx);
    }

    if (isNbspGlueFix(fix)) {
      for (let i = 0; i < fix.after.length; i++) {
        newGlueIndexes.add(fix.from + i);
      }
    }
  }

  return { text: out, newGlueIndexes };
}

/**
 * @param newGlueIndexes — позиции NBSP/NNBSP, поставленные glue-правками этого прохода.
 *   Если не передано, все неразрывные считаются «новыми» (оранжевый), для простых вызовов.
 */
export function formatNbspSentenceHtml(text: string, newGlueIndexes?: Set<number>): string {
  const markNew = newGlueIndexes == null;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const code = text.charCodeAt(i);
    if (code === 0x00a0) {
      const isNew = markNew || newGlueIndexes.has(i);
      if (isNew) {
        out +=
          '<span class="ws-mark ws-nbsp" title="неразрывный пробел (U+00A0) — новая склейка">□</span>';
      } else {
        out +=
          '<span class="ws-mark ws-nbsp-existing" title="неразрывный пробел (U+00A0) — уже был в слое">□</span>';
      }
    } else if (code === 0x202f) {
      const isNew = markNew || newGlueIndexes.has(i);
      if (isNew) {
        out +=
          '<span class="ws-mark ws-nnbsp" title="узкий неразрывный пробел (U+202F) — новая склейка">▫</span>';
      } else {
        out +=
          '<span class="ws-mark ws-nnbsp-existing" title="узкий неразрывный пробел (U+202F) — уже был в слое">▫</span>';
      }
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

export function renderNbspGlueSummaryHtml(
  layerFixes: NbspGlueFix[],
  layerSourceText?: string,
): string {
  const glues = layerFixes.filter(isNbspGlueFix);
  if (!glues.length) return "";
  const sourceText =
    layerSourceText ||
    layerFixes.find((f) => f.sourceText)?.sourceText ||
    glues[0]?.sourceText ||
    "";
  const { text: result, newGlueIndexes } = applyReportedFixesWithNewGlueIndexes(
    sourceText,
    layerFixes,
  );
  return `
    <div class="reportFix">
      <div class="reportWhy">${escapeHtml(MSG_TYPO_NBSP_SUMMARY)}</div>
      <div class="reportMeta">${escapeHtml(glueCountLabel(glues.length))}</div>
      <div class="reportNbspSentence">${formatNbspSentenceHtml(result, newGlueIndexes)}</div>
    </div>
  `;
}
