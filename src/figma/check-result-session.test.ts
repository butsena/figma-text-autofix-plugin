import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCheckResultForUi,
  getLastAutoApplyReport,
  setLastAutoApplyReport,
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

  it("buildCheckResultForUi подмешивает lastAutoApplyReport в готовый scan", () => {
    setLastAutoApplyReport({
      summary: { checkedLayers: 1, appliedFixCount: 3, changedLayerCount: 1 },
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
  });

  it("buildCheckResultForUi без scan дергает scanSelectedTextNodes", () => {
    const result = buildCheckResultForUi([]);
    expect(result.summary.checkedLayers).toBe(0);
    expect(result.lastAutoApplyReport).toBeNull();
  });
});
