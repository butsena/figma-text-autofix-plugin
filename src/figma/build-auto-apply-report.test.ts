import { describe, expect, it } from "vitest";
import { buildAutoApplyReport, buildAutoApplyReportFromApplied } from "./build-auto-apply-report";
import type { CheckResultDto } from "../shared/messages";
import type { TextFix } from "../core/autofix-engine";

describe("buildAutoApplyReport", () => {
  it("передаёт позицию и исходный текст для контекста в UI", () => {
    const scan: CheckResultDto = {
      summary: { checkedLayers: 1, foundFixes: 1 },
      cards: [
        {
          nodeId: "1:1",
          nodeName: "Текст",
          originalText: "квартира и дом",
          previewText: "квартира и\u00a0дом",
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
              },
            },
          ],
        },
      ],
    };

    const report = buildAutoApplyReport(scan);
    expect(report.layers[0].fixes[0]).toMatchObject({
      from: 9,
      to: 10,
      sourceText: "квартира и дом",
      ruleId: "cian-095-nbsp-after-short-words-strict",
    });
  });

  it("отчёт только по реально применённым правкам", () => {
    const scan: CheckResultDto = {
      summary: { checkedLayers: 1, foundFixes: 2 },
      cards: [
        {
          nodeId: "1:1",
          nodeName: "Текст",
          originalText: "сохрани твой профиль",
          previewText: "Сохраните ваш профиль",
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
          },
        ],
      ],
    ]);

    const report = buildAutoApplyReportFromApplied(scan, applied);
    expect(report.summary.appliedFixCount).toBe(1);
    expect(report.layers[0].fixes).toHaveLength(1);
    expect(report.layers[0].fixes[0].before).toBe("с");
  });
});
