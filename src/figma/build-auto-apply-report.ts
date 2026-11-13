import type { TextFix } from "../core/autofix-engine";
import { applyTextFixes } from "../core/autofix-engine";
import type { AutoApplyReportDto, CheckResultDto, TextFixDto } from "../shared/messages";
import { countTextCharacters } from "../shared/text-char-count";
import { makeFixId } from "../shared/fix-id";

type AutoApplyFixLine = AutoApplyReportDto["layers"][number]["fixes"][number];

function toAutoApplyFixLineFromEngine(
  nodeId: string,
  fix: TextFix,
): AutoApplyFixLine {
  return {
    fixId: makeFixId(nodeId, fix.ruleId, fix.from, fix.to),
    ruleId: fix.ruleId,
    category: fix.category,
    message: fix.message,
    before: fix.before,
    after: fix.after,
    from: fix.from,
    to: fix.to,
  };
}

function toAutoApplyFixLineFromDto(fix: TextFixDto): AutoApplyFixLine {
  return {
    fixId: fix.fixId,
    ruleId: fix.rule.id,
    category: fix.rule.category,
    message: fix.rule.message,
    before: fix.before,
    after: fix.after,
    from: fix.from,
    to: fix.to,
  };
}

/** Склеить отчёты нескольких проходов автоисправления (по слоям и списку замен). */
export function mergeAutoApplyReports(
  acc: AutoApplyReportDto | null,
  next: AutoApplyReportDto,
): AutoApplyReportDto {
  if (!acc) {
    return {
      ...next,
      layers: next.layers.map((l) => ({ ...l, fixes: [...l.fixes] })),
    };
  }

  const layerMap = new Map<string, AutoApplyReportDto["layers"][number]>();
  for (const layer of acc.layers) {
    layerMap.set(layer.nodeId, { ...layer, fixes: [...layer.fixes] });
  }
  for (const layer of next.layers) {
    const prev = layerMap.get(layer.nodeId);
    if (prev) {
      const incoming = layer.fixes.map((fix) => {
        if (fix.sourceText || !layer.sourceText || layer.sourceText === prev.sourceText) return fix;
        return { ...fix, sourceText: layer.sourceText };
      });
      prev.fixes.push(...incoming);
      if (layer.nodeName) prev.nodeName = layer.nodeName;
      if (layer.frameName) prev.frameName = layer.frameName;
      prev.characterCount = layer.characterCount;
    } else {
      layerMap.set(layer.nodeId, { ...layer, fixes: [...layer.fixes] });
    }
  }

  return {
    summary: {
      checkedLayers: acc.summary.checkedLayers,
      appliedFixCount: acc.summary.appliedFixCount + next.summary.appliedFixCount,
      changedLayerCount: layerMap.size,
    },
    layers: [...layerMap.values()],
  };
}

export function buildAutoApplyReportFromApplied(
  scan: CheckResultDto,
  appliedByNode: Map<string, TextFix[]>,
): AutoApplyReportDto {
  const cardByNodeId = new Map(scan.cards.map((c) => [c.nodeId, c]));
  const layers: AutoApplyReportDto["layers"] = [];

  for (const [nodeId, fixes] of appliedByNode.entries()) {
    if (fixes.length === 0) continue;
    const card = cardByNodeId.get(nodeId);
    const sourceText = card?.originalText ?? "";
    layers.push({
      nodeId,
      nodeName: card?.nodeName ?? "",
      ...(card?.frameName ? { frameName: card.frameName } : {}),
      characterCount: countTextCharacters(applyTextFixes(sourceText, fixes)),
      sourceText,
      fixes: fixes.map((f) => toAutoApplyFixLineFromEngine(nodeId, f)),
    });
  }

  const appliedFixCount = layers.reduce((sum, layer) => sum + layer.fixes.length, 0);

  return {
    summary: {
      checkedLayers: scan.summary.checkedLayers,
      appliedFixCount,
      changedLayerCount: layers.length,
    },
    layers,
  };
}

export function buildAutoApplyReportFromConfirmFix(
  nodeId: string,
  nodeName: string,
  fix: TextFixDto,
  sourceText: string,
  frameName?: string,
): AutoApplyReportDto {
  const textAfter =
    fix.before !== fix.after
      ? sourceText.slice(0, fix.from) + fix.after + sourceText.slice(fix.to)
      : sourceText;

  return {
    summary: {
      checkedLayers: 1,
      appliedFixCount: 1,
      changedLayerCount: 1,
    },
    layers: [
      {
        nodeId,
        nodeName,
        ...(frameName ? { frameName } : {}),
        characterCount: countTextCharacters(textAfter),
        sourceText,
        fixes: [toAutoApplyFixLineFromDto(fix)],
      },
    ],
  };
}

export function buildEmptyAutoApplyReport(checkedLayers: number): AutoApplyReportDto {
  return {
    summary: {
      checkedLayers,
      appliedFixCount: 0,
      changedLayerCount: 0,
    },
    layers: [],
  };
}
