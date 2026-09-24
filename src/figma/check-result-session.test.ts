import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckResultForUi,
  getLastAutoApplyReport,
  getLastManualApplyReport,
  setLastAutoApplyReport,
  setLastManualApplyReport,
} from "./check-result-session";

vi.mock("./scan-selection", () => ({
  scanSelectedTextNodes: () => ({
    result: {
      summary: { checkedLayers: 0, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 },
      checkedTextLayers: [],
      cards: [],
      confirmCards: [],
      choiceCards: [],
    },
    nodeById: new Map(),
  }),
}));

describe("check-result-session", () => {
  beforeEach(() => {
    setLastAutoApplyReport(null);
    setLastManualApplyReport(null);
  });

  it("хранит lastAutoApplyReport", () => {
    expect(getLastAutoApplyReport()).toBeNull();
    const report = {
      summary: { checkedLayers: 1, appliedFixCount: 2, changedLayerCount: 1 },
      layers: [],
    };
    setLastAutoApplyReport(report);
    expect(getLastAutoApplyReport()).toEqual(report);
  });

  it("хранит lastManualApplyReport отдельно от auto", () => {
    setLastAutoApplyReport({
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [],
    });
    setLastManualApplyReport({
      summary: { checkedLayers: 1, appliedFixCount: 2, changedLayerCount: 1 },
      layers: [],
    });
    expect(getLastAutoApplyReport()?.summary.appliedFixCount).toBe(1);
    expect(getLastManualApplyReport()?.summary.appliedFixCount).toBe(2);
  });

  it("buildCheckResultForUi подмешивает оба отчёта в готовый scan", () => {
    setLastAutoApplyReport({
      summary: { checkedLayers: 1, appliedFixCount: 3, changedLayerCount: 1 },
      layers: [],
    });
    setLastManualApplyReport({
      summary: { checkedLayers: 1, appliedFixCount: 4, changedLayerCount: 1 },
      layers: [],
    });
    const scan = {
      summary: { checkedLayers: 2, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 },
      checkedTextLayers: [],
      cards: [],
      confirmCards: [],
      choiceCards: [],
    };
    const result = buildCheckResultForUi([], scan);
    expect(result.summary.checkedLayers).toBe(2);
    expect(result.lastAutoApplyReport?.summary.appliedFixCount).toBe(3);
    expect(result.lastManualApplyReport?.summary.appliedFixCount).toBe(4);
  });

  it("buildCheckResultForUi без scan дергает scanSelectedTextNodes", () => {
    const result = buildCheckResultForUi([]);
    expect(result.summary.checkedLayers).toBe(0);
    expect(result.lastAutoApplyReport).toBeNull();
    expect(result.lastManualApplyReport).toBeNull();
  });
});
