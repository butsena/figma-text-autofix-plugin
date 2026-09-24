import { beforeEach, describe, expect, it } from "vitest";
import { renderManualReportHtml, renderReportHtml } from "./ui-render-sections";
import { state } from "./ui-state";

describe("manual vs auto report blocks", () => {
  beforeEach(() => {
    state.summary = { checkedLayers: 1, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 };
    state.lastReport = null;
    state.lastManualReport = null;
    state.ui.reportDetailsOpen = false;
    state.ui.manualReportDetailsOpen = true;
  });

  it("renderManualReportHtml рисует «Вы исправили»", () => {
    state.lastManualReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 10,
          fixes: [
            {
              fixId: "f1",
              ruleId: "orthography-spellcheck",
              category: "orthography",
              message: "msg",
              before: "перд",
              after: "перед",
              from: 0,
              to: 4,
              sourceText: "перд тест",
            },
          ],
        },
      ],
    };

    const html = renderManualReportHtml();
    expect(html).toContain("Вы исправили");
    expect(html).toContain("manualReportDetails");
    expect(html).toContain("перд");
    expect(html).toContain("перед");
    expect(html).not.toContain("Что исправлено автоматически");
    expect(html).not.toContain("Что вы исправили");
  });

  it("renderReportHtml не смешивает ручные правки", () => {
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 5,
          fixes: [
            {
              fixId: "a1",
              ruleId: "cian-yo",
              category: "yo_spelling",
              message: "ё",
              before: "еще",
              after: "ещё",
              from: 0,
              to: 3,
              sourceText: "еще",
            },
          ],
        },
      ],
    };
    state.lastManualReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 5,
          fixes: [
            {
              fixId: "m1",
              ruleId: "orthography-spellcheck",
              category: "orthography",
              message: "msg",
              before: "перд",
              after: "перед",
              from: 0,
              to: 4,
              sourceText: "перд",
            },
          ],
        },
      ],
    };

    const autoHtml = renderReportHtml();
    expect(autoHtml).toContain("Что исправлено автоматически");
    expect(autoHtml).toContain("еще");
    expect(autoHtml).not.toContain("перд");
  });
});
