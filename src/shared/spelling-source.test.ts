import { describe, expect, it } from "vitest";
import { classifySpellingSource, normalizeSpellingSource } from "./spelling-source";

describe("classifySpellingSource", () => {
  it.each([
    ["Кватира", "Квартира", "Квартира", "suggested"],
    ["Кватира", "Квартира", "Квартирка", "custom"],
    ["Кватира", "", "Квартира", "custom"],
    ["Кватира", "   ", "Квартира", "custom"],
    ["Кватира", "Кватира", "Квартира", "custom"],
    ["Кватира", "  КВАТИРА ", "Квартира", "custom"],
    // Ручной набор/вставка той же подсказки не меняет её источник.
    ["кватира", "квартира", "квартира", "suggested"],
    ["Кватира", "квартира", "КВАРТИРА", "suggested"],
    [",elbnt", " будут", "Будут ", "suggested"],
    ["тест", "новый дом", "новый  дом", "custom"],
    ["тест", "новый дом", "новый\u00a0дом", "custom"],
    ["тест", "ещё", "еще", "custom"],
    ["тест", "йод", "и\u0306од", "suggested"],
  ])("%j → подсказка %j, замена %j: %s", (before, suggested, after, source) => {
    expect(classifySpellingSource(before, suggested, after)).toBe(source);
  });
});

describe("normalizeSpellingSource", () => {
  it.each(["suggested", "custom", "unknown"] as const)("сохраняет enum %s", (source) => {
    expect(normalizeSpellingSource(source)).toBe(source);
  });

  it.each([undefined, null, "SUGGESTED", "secret text", 1, {}, ["custom"]])(
    "неизвестные метаданные становятся unknown: %j",
    (source) => expect(normalizeSpellingSource(source)).toBe("unknown"),
  );
});
