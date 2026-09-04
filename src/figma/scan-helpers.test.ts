import { describe, expect, it, vi } from "vitest";
import type { TextFix } from "../core/autofix-engine";
import { partitionFixesByPolicy, toFixDto } from "./scan-fix-dto";
import { filterRulesByPolicy, mergeAutofixAndSpellingFixes } from "./scan-text-check";

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

describe("filterRulesByPolicy", () => {
  it("auto не включает choice-правила", () => {
    const auto = filterRulesByPolicy("auto");
    const choice = filterRulesByPolicy("choice");
    expect(auto.every((r) => (r.applyPolicy ?? "auto") === "auto")).toBe(true);
    expect(choice.length).toBeGreaterThan(0);
    expect(choice.every((r) => r.applyPolicy === "choice")).toBe(true);
  });
});

describe("mergeAutofixAndSpellingFixes", () => {
  it("без spell-правок возвращает исходный список", async () => {
    vi.resetModules();
    vi.doMock("../spell/check-spelling", () => ({
      checkSpellingFixes: () => [],
    }));
    const { mergeAutofixAndSpellingFixes: merge } = await import("./scan-text-check");
    const existing = [
      fix({ from: 0, to: 1, before: "а", after: "б", ruleId: "r1", priority: 10 }),
    ];
    expect(merge("а", existing)).toBe(existing);
    vi.doUnmock("../spell/check-spelling");
    vi.resetModules();
  });

  it("сортирует объединённый список по позиции и priority", async () => {
    vi.resetModules();
    vi.doMock("../spell/check-spelling", () => ({
      checkSpellingFixes: () => [
        {
          from: 0,
          to: 2,
          before: "xx",
          after: "yy",
          ruleId: "spell",
          category: "orthography",
          message: "орф",
          priority: 72,
          applyPolicy: "confirm",
        },
      ],
    }));
    const { mergeAutofixAndSpellingFixes: merge } = await import("./scan-text-check");
    const existing = [
      fix({ from: 0, to: 2, before: "xx", after: "zz", ruleId: "other", priority: 10 }),
      fix({ from: 5, to: 6, before: "a", after: "b", ruleId: "later", priority: 1 }),
    ];
    const merged = merge("xx a", existing);
    expect(merged.map((f) => f.ruleId)).toEqual(["spell", "other", "later"]);
    vi.doUnmock("../spell/check-spelling");
    vi.resetModules();
  });
});
