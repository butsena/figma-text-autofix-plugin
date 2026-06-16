import type { TextFix } from "../core/autofix-engine";
import type { AutoApplyReportDto, CheckResultDto, TextFixDto } from "../shared/messages";

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
      prev.fixes.push(...layer.fixes);
      if (layer.nodeName) prev.nodeName = layer.nodeName;
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
    layers.push({
      nodeId,
      nodeName: card?.nodeName ?? "",
      fixes: fixes.map((f) => ({
        fixId: `${nodeId}:${f.ruleId}:${f.from}:${f.to}`,
        ruleId: f.ruleId,
        category: f.category,
        message: f.message,
        before: f.before,
        after: f.after,
        from: f.from,
        to: f.to,
        sourceText: card?.originalText ?? "",
      })),
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
): AutoApplyReportDto {
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
        fixes: [
          {
            fixId: fix.fixId,
            ruleId: fix.rule.id,
            category: fix.rule.category,
            message: fix.rule.message,
            before: fix.before,
            after: fix.after,
            from: fix.from,
            to: fix.to,
            sourceText,
          },
        ],
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

/** @deprecated Используйте buildAutoApplyReportFromApplied. */
export function buildAutoApplyReport(scan: CheckResultDto): AutoApplyReportDto {
  return {
    summary: {
      checkedLayers: scan.summary.checkedLayers,
      appliedFixCount: 0,
      changedLayerCount: scan.cards.length,
    },
    layers: scan.cards.map((c) => ({
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      fixes: c.fixes.map((f) => ({
        fixId: f.fixId,
        ruleId: f.rule.id,
        category: f.rule.category,
        message: f.rule.message,
        before: f.before,
        after: f.after,
        from: f.from,
        to: f.to,
        sourceText: c.originalText,
      })),
    })),
  };
}
