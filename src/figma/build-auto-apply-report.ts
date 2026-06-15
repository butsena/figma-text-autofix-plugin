import type { AutoApplyReportDto, CheckResultDto } from "../shared/messages";

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
      })),
    })),
  };
}
