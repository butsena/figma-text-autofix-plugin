import { describe, expect, it } from "vitest";
import { buildAutoApplyReport } from "./build-auto-apply-report";
import type { CheckResultDto } from "../shared/messages";

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
});
