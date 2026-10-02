import { describe, expect, it, vi } from "vitest";
import type { TextFix } from "../core/autofix-engine";
import {
  ORTHOGRAPHY_LAYOUT_RULE_ID,
  ORTHOGRAPHY_SPELL_RULE_ID,
} from "../rules/orthography-spell-rules";
import {
  dropSentenceCapOverlappingOrthography,
  filterRulesByPolicy,
  mergeAutofixAndSpellingFixes,
} from "./scan-text-check";

function fix(partial: Partial<TextFix> & Pick<TextFix, "from" | "to" | "before" | "after" | "ruleId">): TextFix {
  return {
    category: "test",
    message: "msg",
    priority: 50,
    applyPolicy: "auto",
    ...partial,
  };
}

describe("dropSentenceCapOverlappingOrthography", () => {
  it("убирает заглавную на мусоре без подсказки", () => {
    const out = dropSentenceCapOverlappingOrthography([
      fix({
        from: 0,
        to: 1,
        before: "ъ",
        after: "Ъ",
        ruleId: "cian-138-sentence-start-capitalize",
        applyPolicy: "confirm",
      }),
      fix({
        from: 0,
        to: 8,
        before: "ъъъаффжж",
        after: "ъъъаффжж",
        ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
        applyPolicy: "confirm",
      }),
    ]);
    expect(out.map((f) => f.ruleId)).toEqual([ORTHOGRAPHY_SPELL_RULE_ID]);
  });

  it("оставляет заглавную, если орфография предлагает замену", () => {
    const out = dropSentenceCapOverlappingOrthography([
      fix({
        from: 0,
        to: 1,
        before: "п",
        after: "П",
        ruleId: "cian-138-sentence-start-capitalize",
        applyPolicy: "confirm",
      }),
      fix({
        from: 0,
        to: 6,
        before: "превет",
        after: "привет",
        ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
        applyPolicy: "confirm",
      }),
    ]);
    expect(out.map((f) => f.ruleId)).toEqual([
      "cian-138-sentence-start-capitalize",
      ORTHOGRAPHY_SPELL_RULE_ID,
    ]);
  });

  it("убирает заглавную при раскладке на том же слове", () => {
    const out = dropSentenceCapOverlappingOrthography([
      fix({
        from: 0,
        to: 1,
        before: "g",
        after: "G",
        ruleId: "cian-138-sentence-start-capitalize",
        applyPolicy: "confirm",
      }),
      fix({
        from: 0,
        to: 6,
        before: "ghbdtn",
        after: "привет",
        ruleId: ORTHOGRAPHY_LAYOUT_RULE_ID,
        applyPolicy: "confirm",
      }),
    ]);
    expect(out.map((f) => f.ruleId)).toEqual([ORTHOGRAPHY_LAYOUT_RULE_ID]);
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
