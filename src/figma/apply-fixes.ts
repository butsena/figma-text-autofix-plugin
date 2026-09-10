import type { TextFix } from "../core/autofix-engine";
import { isManualPolicy } from "../core/apply-policy";
import type { CheckResultDto } from "../shared/messages";
import { orderFixesForApply } from "../shared/fix-sort";
import { textFixDtoToEngineFix } from "../shared/text-fix-mapping";
import { isCaseOnlyChange } from "./apply-fixes-helpers";
import { applyCharStyleAt, captureRangeStyles, restoreRangeStyles } from "./text-style-snapshot";

async function loadFontName(font: FontName): Promise<void> {
  await figma.loadFontAsync(font);
}

async function loadFontsForTextNode(textNode: TextNode): Promise<void> {
  const len = textNode.characters.length;
  if (len === 0) {
    const font = textNode.fontName;
    if (font !== figma.mixed) await loadFontName(font);
    return;
  }

  const fontNames = textNode.getRangeAllFontNames(0, len);
  const seen = new Set<string>();

  for (const fontName of fontNames) {
    const key = `${fontName.family}__${fontName.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await loadFontName(fontName);
    } catch (error) {
      console.warn("[text-autofix] font load failed", fontName, error);
    }
  }
}

async function loadFontsForRange(textNode: TextNode, from: number, to: number): Promise<void> {
  const len = textNode.characters.length;
  if (len === 0 || to <= from) return;

  const safeFrom = Math.max(0, Math.min(from, len));
  const safeTo = Math.max(safeFrom, Math.min(to, len));
  if (safeTo <= safeFrom) return;

  const fontNames = textNode.getRangeAllFontNames(safeFrom, safeTo);
  const seen = new Set<string>();
  for (const fontName of fontNames) {
    const key = `${fontName.family}__${fontName.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await figma.loadFontAsync(fontName);
  }
}

export type ApplyFixesBatchResult = {
  appliedCount: number;
  appliedByNode: Map<string, TextFix[]>;
};

/**
 * Применить правки посимвольно, сохраняя смешанное форматирование слоя.
 * Индексы fix — относительно текста на момент сканирования; порядок с конца это учитывает.
 */
export async function applyTextFixesToTextNode(
  textNode: TextNode,
  fixes: TextFix[],
): Promise<TextFix[]> {
  if (fixes.length === 0) return [];

  await loadFontsForTextNode(textNode);

  const applied: TextFix[] = [];
  for (const fix of orderFixesForApply(fixes)) {
    try {
      const current = textNode.characters.slice(fix.from, fix.to);
      if (current !== fix.before || fix.before === fix.after) {
        if (current !== fix.before) {
          console.warn(
            "[text-autofix] skip fix: text changed",
            fix.ruleId,
            JSON.stringify({ expected: fix.before, actual: current, from: fix.from, to: fix.to }),
          );
        }
        continue;
      }

      await loadFontsForRange(textNode, fix.from, fix.to);

      const capturedStyles = captureRangeStyles(textNode, fix.from, fix.to);
      const caseOnly = isCaseOnlyChange(fix.before, fix.after);

      textNode.deleteCharacters(fix.from, fix.to);
      if (fix.after.length > 0) {
        textNode.insertCharacters(fix.from, fix.after);
        if (capturedStyles.length > 0) {
          try {
            if (caseOnly) {
              for (let i = 0; i < fix.after.length; i++) {
                const style = capturedStyles[Math.min(i, capturedStyles.length - 1)];
                await applyCharStyleAt(textNode, fix.from + i, style);
              }
            } else {
              await restoreRangeStyles(textNode, fix.from, capturedStyles, fix.after.length);
            }
          } catch (error) {
            console.warn("[text-autofix] style restore failed", fix.ruleId, error);
          }
        }
      }
      applied.push(fix);
    } catch (error) {
      console.warn("[text-autofix] fix apply failed", fix.ruleId, fix.before, error);
    }
  }

  return applied;
}

/** Применить все правки из снимка сканирования к текстовым слоям. */
export async function applyFixesFromScan(
  result: CheckResultDto,
  nodeById: Map<string, TextNode>,
): Promise<ApplyFixesBatchResult> {
  const fixByNodeId = new Map<string, TextFix[]>();

  for (const card of result.cards) {
    for (const fix of card.fixes) {
      if (isManualPolicy(fix.rule.applyPolicy)) continue;
      const list = fixByNodeId.get(card.nodeId) ?? [];
      list.push(textFixDtoToEngineFix(fix));
      fixByNodeId.set(card.nodeId, list);
    }
  }

  const appliedByNode = new Map<string, TextFix[]>();
  let appliedFixesCount = 0;

  for (const [nodeId, fixes] of fixByNodeId.entries()) {
    const node = nodeById.get(nodeId);
    if (!node) {
      console.warn("[text-autofix] text layer not found for apply", nodeId);
      continue;
    }

    try {
      const applied = await applyTextFixesToTextNode(node, fixes);
      if (applied.length > 0) {
        appliedByNode.set(nodeId, applied);
        appliedFixesCount += applied.length;
      }
    } catch (error) {
      console.warn("[text-autofix] failed to apply fixes to layer", nodeId, error);
    }
  }

  return { appliedCount: appliedFixesCount, appliedByNode };
}
