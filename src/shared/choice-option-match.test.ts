import { describe, expect, it } from "vitest";
import { matchingChoiceOptionIndex } from "./choice-option-match";

describe("matchingChoiceOptionIndex", () => {
  const vseVsyo = ["все", "всё"] as const;
  const zhdite = ["ждите", "ждёте"] as const;

  it("выбирает точное все/всё и не схлопывает их через ё", () => {
    expect(matchingChoiceOptionIndex("все", vseVsyo)).toBe(0);
    expect(matchingChoiceOptionIndex("всё", vseVsyo)).toBe(1);
    expect(matchingChoiceOptionIndex("ВСЁ", vseVsyo)).toBe(1);
    expect(matchingChoiceOptionIndex("Все", vseVsyo)).toBe(0);
  });

  it("сопоставляет е-написание единственному варианту с ё", () => {
    expect(matchingChoiceOptionIndex("ждете", zhdite)).toBe(1);
    expect(matchingChoiceOptionIndex("ждёте", zhdite)).toBe(1);
    expect(matchingChoiceOptionIndex("ждите", zhdite)).toBe(0);
    expect(matchingChoiceOptionIndex("Ждете", zhdite)).toBe(1);
  });

  it("не угадывает, если ни один вариант не подходит", () => {
    expect(matchingChoiceOptionIndex("пишите", vseVsyo)).toBeNull();
  });
});
