import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  anchorCheckedTextNodes,
  buildCheckResultForUi,
  getLastAutoApplyReport,
  getLastManualApplyReport,
  resetAnchoredTextNodesForTests,
  setLastAutoApplyReport,
  setLastManualApplyReport,
} from "./check-result-session";

const scannedSelections = vi.hoisted(() => [] as unknown[]);

vi.mock("./scan-selection", () => ({
  scanSelectedTextNodes: (selection: unknown) => {
    scannedSelections.push(selection);
    const checkedLayers = Array.isArray(selection) ? selection.length : 0;
    return {
      result: {
        summary: { checkedLayers, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 },
        checkedTextLayers: [],
        cards: [],
        confirmCards: [],
        choiceCards: [],
      },
      nodeById: new Map(),
    };
  },
}));

describe("check-result-session", () => {
  beforeEach(() => {
    setLastAutoApplyReport(null);
    setLastManualApplyReport(null);
    resetAnchoredTextNodesForTests();
    scannedSelections.length = 0;
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

  it("пустой selection после «Исправить» не обнуляет уже проверенные слои", () => {
    const node = { id: "1:2", type: "TEXT", parent: null, removed: false };
    anchorCheckedTextNodes([node as unknown as SceneNode]);
    const result = buildCheckResultForUi([]);
    expect(result.summary.checkedLayers).toBe(1);
    expect(scannedSelections.at(-1)).toEqual([node]);
  });
});
