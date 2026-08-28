import { describe, expect, it } from "vitest";
import {
  buildAutoApplyReportFromApplied,
  buildAutoApplyReportFromConfirmFix,
  buildEmptyAutoApplyReport,
  mergeAutoApplyReports,
} from "./build-auto-apply-report";
import type { CheckResultDto } from "../shared/messages";
import type { TextFix } from "../core/autofix-engine";

describe("build-auto-apply-report", () => {
  it("передаёт позицию и исходный текст для контекста в UI", () => {
    const scan: CheckResultDto = {
      summary: { checkedLayers: 1, foundFixes: 1, confirmFixes: 0, choiceFixes: 0 },
      checkedTextLayers: [{ nodeId: "1:1", nodeName: "Текст", characterCount: 14 }],
      cards: [
        {
          nodeId: "1:1",
          nodeName: "Текст",
          originalText: "квартира и дом",
          previewText: "квартира и\u00a0дом",
          characterCount: 14,
          fixes: [
            {
              fixId: "1:1:cian-095:9:10",
              from: 9,
              to: 10,
              before: " ",
              after: "\u00a0",
              rule: {
                id: "cian-095-nbsp-after-short-words-strict",
                category: "typography",
                message: "NBSP после служебных слов",
                priority: 52,
                applyPolicy: "auto",
              },
            },
          ],
        },
      ],
    };

    const applied = new Map<string, TextFix[]>([
      [
        "1:1",
        [
          {
            from: 9,
            to: 10,
            before: " ",
            after: "\u00a0",
            ruleId: "cian-095-nbsp-after-short-words-strict",
            category: "typography",
            message: "NBSP после служебных слов",
            priority: 52,
            applyPolicy: "auto",
          },
        ],
      ],
    ]);

    const report = buildAutoApplyReportFromApplied(scan, applied);
    expect(report.layers[0].fixes[0]).toMatchObject({
      from: 9,
      to: 10,
      sourceText: "квартира и дом",
      ruleId: "cian-095-nbsp-after-short-words-strict",
    });
    expect(report.layers[0].characterCount).toBe(14);
  });

  it("отчёт только по реально применённым правкам", () => {
    const scan: CheckResultDto = {
      summary: { checkedLayers: 1, foundFixes: 2, confirmFixes: 0, choiceFixes: 0 },
      checkedTextLayers: [{ nodeId: "1:1", nodeName: "Текст", characterCount: 20 }],
      cards: [
        {
          nodeId: "1:1",
          nodeName: "Текст",
          originalText: "сохрани твой профиль",
          previewText: "Сохраните ваш профиль",
          characterCount: 20,
          fixes: [
            {
              fixId: "1:1:a:0:1",
              from: 0,
              to: 1,
              before: "с",
              after: "С",
              rule: {
                id: "cian-138-sentence-start-capitalize",
                category: "typography",
                message: "Капитализация",
                priority: 90,
                applyPolicy: "auto",
              },
            },
            {
              fixId: "1:1:b:6:7",
              from: 6,
              to: 7,
              before: "и",
              after: "ите",
              rule: {
                id: "cian-ty-vy-13",
                category: "cian_editorial",
                message: "Ты→вы",
                priority: 59,
                applyPolicy: "auto",
              },
            },
          ],
        },
      ],
    };

    const applied = new Map<string, TextFix[]>([
      [
        "1:1",
        [
          {
            from: 0,
            to: 1,
            before: "с",
            after: "С",
            ruleId: "cian-138-sentence-start-capitalize",
            category: "typography",
            message: "Капитализация",
            priority: 90,
            applyPolicy: "auto",
          },
        ],
      ],
    ]);

    const report = buildAutoApplyReportFromApplied(scan, applied);
    expect(report.summary.appliedFixCount).toBe(1);
    expect(report.layers[0].fixes).toHaveLength(1);
    expect(report.layers[0].fixes[0].before).toBe("с");
  });

  it("пустой отчёт для случая без правок", () => {
    const report = buildEmptyAutoApplyReport(3);
    expect(report.summary).toEqual({
      checkedLayers: 3,
      appliedFixCount: 0,
      changedLayerCount: 0,
    });
    expect(report.layers).toEqual([]);
  });

  it("учитывает принятую confirm-правку в счётчике и отчёте", () => {
    const confirmReport = buildAutoApplyReportFromConfirmFix(
      "1:1",
      "Текст",
      {
        fixId: "1:1:cian-139a:66:66",
        from: 66,
        to: 66,
        before: "",
        after: ".",
        rule: {
          id: "cian-139a-implicit-sentence-period",
          category: "cian_editorial",
          message: "Редполитика: похоже, между словами пропущена точка.",
          priority: 87,
          applyPolicy: "confirm",
        },
      },
      "по запросу Главное",
    );
    const autoReport = buildEmptyAutoApplyReport(1);
    autoReport.summary.appliedFixCount = 2;
    autoReport.layers = [
      {
        nodeId: "1:1",
        nodeName: "Текст",
        characterCount: 4,
        fixes: [
          {
            fixId: "a",
            ruleId: "cian-139-sentence-terminal-period",
            category: "cian_editorial",
            message: "Редполитика: точка в конце предложения.",
            before: "",
            after: ".",
            from: 100,
            to: 100,
            sourceText: "текст",
          },
          {
            fixId: "b",
            ruleId: "cian-139-sentence-terminal-period",
            category: "cian_editorial",
            message: "Редполитика: точка в конце предложения.",
            before: "",
            after: ".",
            from: 50,
            to: 50,
            sourceText: "текст",
          },
        ],
      },
    ];

    const merged = mergeAutoApplyReports(confirmReport, autoReport);
    expect(merged.summary.appliedFixCount).toBe(3);
    expect(merged.layers[0].fixes).toHaveLength(3);
    expect(merged.layers[0].fixes[0].ruleId).toBe("cian-139a-implicit-sentence-period");
    expect(confirmReport.layers[0].characterCount).toBe(19);
  });
});
