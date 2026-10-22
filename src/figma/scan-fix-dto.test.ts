import { describe, expect, it } from "vitest";
import type { TextFix } from "../core/autofix-engine";
import {
  buildCardForNode,
  buildCheckSummary,
  buildCheckedTextLayers,
  containingFrameName,
  partitionFixesByPolicy,
  toFixDto,
} from "./scan-fix-dto";

function fix(partial: Partial<TextFix> & Pick<TextFix, "from" | "to" | "before" | "after" | "ruleId">): TextFix {
  return {
    category: "test",
    message: "msg",
    priority: 50,
    applyPolicy: "auto",
    ...partial,
  };
}

describe("partitionFixesByPolicy", () => {
  it("раскладывает auto / confirm / choice", () => {
    const { auto, confirm, choice } = partitionFixesByPolicy([
      fix({ from: 0, to: 1, before: "a", after: "b", ruleId: "auto-1", applyPolicy: "auto" }),
      fix({
        from: 2,
        to: 3,
        before: "c",
        after: "d",
        ruleId: "confirm-1",
        applyPolicy: "confirm",
      }),
      fix({
        from: 4,
        to: 5,
        before: "e",
        after: "e",
        ruleId: "choice-1",
        applyPolicy: "choice",
        choiceOptions: ["e", "ё"],
      }),
    ]);
    expect(auto.map((f) => f.ruleId)).toEqual(["auto-1"]);
    expect(confirm.map((f) => f.ruleId)).toEqual(["confirm-1"]);
    expect(choice.map((f) => f.ruleId)).toEqual(["choice-1"]);
  });
});

describe("buildCheckSummary", () => {
  it("добавляет checkedLayers из списка нод", () => {
    const nodes = [{ id: "1" }, { id: "2" }] as unknown as TextNode[];
    expect(
      buildCheckSummary(nodes, { foundFixes: 3, confirmFixes: 1, choiceFixes: 2 }),
    ).toEqual({
      checkedLayers: 2,
      foundFixes: 3,
      confirmFixes: 1,
      choiceFixes: 2,
    });
  });
});

describe("buildCheckedTextLayers", () => {
  it("считает символы и запоминает текст с именем фрейма", () => {
    const frame = { type: "FRAME", name: "Карточка", parent: null };
    const longText = "а".repeat(26);
    const nodes = [
      { id: "1:1", name: "A", characters: "привет", parent: frame },
      {
        id: "1:2",
        name: "B",
        characters: longText,
        parent: { type: "PAGE", name: "Page 1", parent: null },
      },
    ] as unknown as TextNode[];
    expect(buildCheckedTextLayers(nodes)).toEqual([
      {
        nodeId: "1:1",
        nodeName: "A",
        characterCount: 6,
        text: "привет",
        frameName: "Карточка",
      },
      {
        nodeId: "1:2",
        nodeName: "B",
        characterCount: 26,
        text: longText,
        frameName: "B",
      },
    ]);
    expect(containingFrameName(nodes[0]!)).toBe("Карточка");
  });
});

describe("toFixDto", () => {
  it("прокидывает hintHtml и choiceOptions", () => {
    const [dto] = toFixDto("1:1", [
      fix({
        from: 0,
        to: 5,
        before: "ищите",
        after: "ищите",
        ruleId: "cian-choice-ishchite-ishchete",
        applyPolicy: "choice",
        hintHtml: "<div>подсказка</div>",
        choiceOptions: ["ищите", "ищете"],
      }),
    ]);
    expect(dto.fixId).toContain("cian-choice-ishchite-ishchete");
    expect(dto.rule.hintHtml).toBe("<div>подсказка</div>");
    expect(dto.rule.choiceOptions).toEqual(["ищите", "ищете"]);
    expect(dto.rule.applyPolicy).toBe("choice");
  });
});

describe("buildCardForNode", () => {
  it("null без правок", () => {
    const node = { id: "1", name: "t", characters: "текст" } as unknown as TextNode;
    expect(buildCardForNode(node, [], "auto")).toBeNull();
  });

  it("manual оставляет originalText в preview", () => {
    const node = { id: "1", name: "t", characters: "abc" } as unknown as TextNode;
    const card = buildCardForNode(
      node,
      [fix({ from: 0, to: 3, before: "abc", after: "xyz", ruleId: "r" })],
      "manual",
    );
    expect(card?.originalText).toBe("abc");
    expect(card?.previewText).toBe("abc");
    expect(card?.fixes).toHaveLength(1);
  });

  it("auto применяет правки в preview", () => {
    const node = { id: "1", name: "t", characters: "abc" } as unknown as TextNode;
    const card = buildCardForNode(
      node,
      [fix({ from: 0, to: 3, before: "abc", after: "xyz", ruleId: "r" })],
      "auto",
    );
    expect(card?.previewText).toBe("xyz");
  });
});
