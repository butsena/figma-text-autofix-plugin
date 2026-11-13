import type { TextFix } from "../core/autofix-engine";
import { AnalyticsFailure, annotateFailure } from "../analytics/failure";
import { trackPluginError } from "../analytics/pipeline-events";
import type { AnalyticsErrorStage } from "../analytics/schema";
import { isManualPolicy } from "../core/apply-policy";
import type { CheckResultDto } from "../shared/messages";
import { orderFixesForApply } from "../shared/fix-sort";
import { textFixDtoToEngineFix } from "../shared/text-fix-mapping";
import { isCaseOnlyChange } from "./apply-fixes-helpers";
import {
  applyCharStyleAt,
  captureRangeStyles,
  captureUniformRangeStyle,
  caseStylesAreUniform,
  restoreRangeStyles,
  type CharTextStyle,
} from "./text-style-snapshot";

/** true — фрагмент уже не тот, правку писать нельзя. */
function fragmentIsStale(textNode: TextNode, fix: TextFix): boolean {
  const current = textNode.characters.slice(fix.from, fix.to);
  if (current === fix.before && fix.before !== fix.after) return false;
  if (current !== fix.before) {
    console.warn(
      "[text-autofix] skip fix: text changed",
      fix.ruleId,
      JSON.stringify({ expected: fix.before, actual: current, from: fix.from, to: fix.to }),
    );
  }
  return true;
}

async function loadFontName(font: FontName): Promise<void> {
  await figma.loadFontAsync(font);
}

async function loadFontsForTextNode(textNode: TextNode): Promise<Set<string>> {
  const failed = new Set<string>();
  const len = textNode.characters.length;
  if (len === 0) {
    const font = textNode.fontName;
    if (font !== figma.mixed) {
      try {
        await loadFontName(font);
      } catch (error) {
        failed.add(`${font.family}__${font.style}`);
        console.warn("[text-autofix] font load failed", font, error);
      }
    }
    return failed;
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
      failed.add(key);
      console.warn("[text-autofix] font load failed", fontName, error);
    }
  }
  return failed;
}

class FontRangeFailure extends AnalyticsFailure {
  constructor(stage: AnalyticsErrorStage, readonly fontKey: string, error: unknown) {
    super(stage, "font_load_failed", error);
  }
}

async function loadFontsForRange(
  textNode: TextNode, from: number, to: number, stage: AnalyticsErrorStage,
): Promise<void> {
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
    try {
      await figma.loadFontAsync(fontName);
    } catch (error) {
      throw new FontRangeFailure(stage, JSON.stringify([fontName.family, fontName.style]), error);
    }
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
  stage: AnalyticsErrorStage = "auto_apply",
  failedFonts: Set<string> = new Set(),
): Promise<TextFix[]> {
  if (fixes.length === 0) return [];

  let failedOnNode: Set<string>;
  try {
    failedOnNode = await loadFontsForTextNode(textNode);
  } catch (error) {
    throw annotateFailure(error, stage, "font_load_failed");
  }

  const nodeLength = textNode.characters.length;
  const nodeUniform = nodeLength > 0 ? captureUniformRangeStyle(textNode, 0, nodeLength) : null;

  const stylesForFix = (from: number, to: number): CharTextStyle[] => {
    if (nodeUniform) return [nodeUniform];
    const rangeUniform = captureUniformRangeStyle(textNode, from, to);
    if (rangeUniform) return [rangeUniform];
    return captureRangeStyles(textNode, from, to);
  };

  const applied: TextFix[] = [];
  // Only repeated failures of the same font within this layer operation are coalesced.
  // Different fonts, layers and subsequent operations remain separate problems.
  for (const fix of orderFixesForApply(fixes)) {
    try {
      if (fragmentIsStale(textNode, fix)) continue;

      // Шрифты слоя уже загружены. Повторный getRangeAllFontNames нужен только там,
      // где какой-то шрифт не загрузился: тогда пропускаем правку этого диапазона.
      if (failedOnNode.size > 0) {
        await loadFontsForRange(textNode, fix.from, fix.to, stage);
      }
      // Пока грузился шрифт, параллельный клик мог уже записать тот же фрагмент.
      if (fragmentIsStale(textNode, fix)) continue;

      const capturedStyles = stylesForFix(fix.from, fix.to);
      const caseOnly = isCaseOnlyChange(fix.before, fix.after);

      textNode.deleteCharacters(fix.from, fix.to);
      if (fix.after.length > 0) {
        textNode.insertCharacters(fix.from, fix.after);
        if (capturedStyles.length > 0) {
          try {
            if (caseOnly && !caseStylesAreUniform(capturedStyles)) {
              for (let i = 0; i < fix.after.length; i++) {
                const style = capturedStyles[Math.min(i, capturedStyles.length - 1)];
                await applyCharStyleAt(textNode, fix.from + i, style);
              }
            } else {
              await restoreRangeStyles(textNode, fix.from, capturedStyles, fix.after.length);
            }
          } catch (error) {
            trackPluginError(stage, error, { code: "style_restore_failed" });
            console.warn("[text-autofix] style restore failed", fix.ruleId, error);
          }
        }
      }
      applied.push(fix);
    } catch (error) {
      if (!(error instanceof FontRangeFailure) || !failedFonts.has(error.fontKey)) {
        trackPluginError(stage, error, { code: "apply_failed" });
        if (error instanceof FontRangeFailure) failedFonts.add(error.fontKey);
      }
      console.warn("[text-autofix] fix apply failed", fix.ruleId, fix.before, error);
    }
  }

  return applied;
}

/** Применить все правки из снимка сканирования к текстовым слоям. */
export async function applyFixesFromScan(
  result: CheckResultDto,
  nodeById: Map<string, TextNode>,
  failedFontsByNode: Map<string, Set<string>> = new Map(),
  onLayerApplied?: (appliedInBatch: number) => void,
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
      trackPluginError("auto_apply", null, { code: "node_missing" });
      console.warn("[text-autofix] text layer not found for apply", nodeId);
      continue;
    }

    try {
      const failedFonts = failedFontsByNode.get(nodeId) ?? new Set<string>();
      failedFontsByNode.set(nodeId, failedFonts);
      const applied = await applyTextFixesToTextNode(node, fixes, "auto_apply", failedFonts);
      if (applied.length > 0) {
        appliedByNode.set(nodeId, applied);
        appliedFixesCount += applied.length;
      }
    } catch (error) {
      trackPluginError("auto_apply", error, { code: "apply_failed" });
      console.warn("[text-autofix] failed to apply fixes to layer", nodeId, error);
    }
    onLayerApplied?.(appliedFixesCount);
  }

  return { appliedCount: appliedFixesCount, appliedByNode };
}
