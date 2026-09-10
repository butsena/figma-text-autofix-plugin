import { describe, expect, it, vi } from "vitest";
import type { TextFix } from "../core/autofix-engine";
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
