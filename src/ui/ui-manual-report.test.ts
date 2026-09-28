import { beforeEach, describe, expect, it } from "vitest";
import { MSG_TYPO_EMDASH } from "../rules/rule-messages";
import {
  renderManualReportHtml,
  renderReportHtml,
  renderResultHeaderHtml,
} from "./ui-render-sections";
import { state } from "./ui-state";

describe("manual vs auto report blocks", () => {
  beforeEach(() => {
    state.summary = { checkedLayers: 1, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 };
    state.lastReport = null;
    state.lastManualReport = null;
    state.spellcheckInProgress = false;
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
    expect(html).not.toContain("Исправлено автоматически");
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
    expect(autoHtml).toContain("Исправлено автоматически");
    expect(autoHtml).not.toContain("Что исправлено автоматически");
    expect(autoHtml).toContain("еще");
    expect(autoHtml).not.toContain("перд");
  });

  it("авто-отчёт схлопывает неразрывные пробелы в одно саммари", () => {
    const nbsp = "\u00a0";
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 4, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 10,
          fixes: [
            {
              fixId: "b1",
              ruleId: "cian-001-cian-brand-uppercase",
              category: "cian_branding",
              message: "Бренд: «ЦИАН» → «Циан»",
              before: "ЦИАН",
              after: "Циан",
              from: 0,
              to: 4,
              sourceText: "ЦИАН и дом",
            },
            {
              fixId: "n1",
              ruleId: "cian-095-nbsp-и",
              category: "typography",
              message: "Типографика: неразрывный пробел после служебного слова",
              before: " ",
              after: nbsp,
              from: 6,
              to: 7,
              sourceText: "ЦИАН и дом",
            },
          ],
        },
      ],
    };

    const html = renderReportHtml();
    expect(html).toContain("Исправлено автоматически");
    expect(html).toContain("Бренд: «ЦИАН» → «Циан»");
    expect(html).toContain("Типографика: неразрывные пробелы");
    expect(html).toContain("1 склейка в этом слое");
    expect(html).toContain("Циан и");
    expect(html).toContain("ws-nbsp");
    expect(html).not.toContain("cian-095-nbsp-и");
    expect(html).not.toContain("Типографика: неразрывный пробел после служебного слова");
  });

  it("шапка «Исправлено» считает склейки, даже если в отчёте одно саммари", () => {
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 4, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 20,
          fixes: [
            {
              fixId: "b1",
              ruleId: "cian-001-cian-brand-uppercase",
              category: "cian_branding",
              message: "Бренд: «ЦИАН» → «Циан»",
              before: "ЦИАН",
              after: "Циан",
              from: 0,
              to: 4,
              sourceText: "ЦИАН и дом",
            },
            {
              fixId: "n1",
              ruleId: "cian-095-nbsp-и",
              category: "typography",
              message: "Типографика: неразрывный пробел после служебного слова",
              before: " ",
              after: "\u00a0",
              from: 6,
              to: 7,
              sourceText: "ЦИАН и дом",
            },
          ],
        },
      ],
    };
    const header = renderResultHeaderHtml();
    expect(header).toMatch(/Исправлено[\s\S]*?>4</);
  });

  it("тире остаётся отдельной строкой рядом с саммари NBSP", () => {
    const nbsp = "\u00a0";
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 2, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 8,
          fixes: [
            {
              fixId: "g1",
              ruleId: "cian-095-nbsp-да",
              category: "typography",
              message: "Типографика: неразрывный пробел после служебного слова",
              before: " ",
              after: nbsp,
              from: 2,
              to: 3,
              sourceText: "да - нет",
            },
            {
              fixId: "d1",
              ruleId: "cian-117-normalize-spaced-dashes-to-emdash",
              category: "punctuation_typography",
              message: MSG_TYPO_EMDASH,
              before: " - ",
              after: `${nbsp}— `,
              from: 2,
              to: 5,
              sourceText: "да - нет",
            },
          ],
        },
      ],
    };
    const html = renderReportHtml();
    expect(html).toContain(MSG_TYPO_EMDASH);
    expect(html).toContain("Типографика: неразрывные пробелы");
    expect(html).toContain("1 склейка в этом слое");
    expect(html).not.toContain("cian-095-nbsp-да");
    expect(html).not.toContain("Типографика: неразрывный пробел после служебного слова");
  });

  it("ручной отчёт не схлопывает NBSP", () => {
    const nbsp = "\u00a0";
    state.lastManualReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 10,
          fixes: [
            {
              fixId: "n1",
              ruleId: "cian-095-nbsp-и",
              category: "typography",
              message: "Типографика: неразрывный пробел после служебного слова",
              before: " ",
              after: nbsp,
              from: 9,
              to: 10,
              sourceText: "квартира и дом",
            },
          ],
        },
      ],
    };
    const html = renderManualReportHtml();
    expect(html).toContain("Типографика: неразрывный пробел после служебного слова");
    expect(html).not.toContain("Типографика: неразрывные пробелы");
  });
});
