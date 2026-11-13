import { describe, expect, it } from "vitest";
import { extractCyrillicWordTokens, shouldSkipSpellToken } from "./tokenize-cyrillic-words";

describe("extractCyrillicWordTokens", () => {
  it("находит кириллические слова с позициями", () => {
    expect(extractCyrillicWordTokens("Кватира в доме")).toEqual([
      { word: "Кватира", from: 0, to: 7 },
      { word: "доме", from: 10, to: 14 },
    ]);
  });

  it("не режет по латинице и цифрам внутри — только кириллические куски ≥2", () => {
    expect(extractCyrillicWordTokens("a1")).toEqual([]);
    expect(extractCyrillicWordTokens("я")).toEqual([]);
    expect(extractCyrillicWordTokens("ёж")).toEqual([{ word: "ёж", from: 0, to: 2 }]);
  });
});

describe("shouldSkipSpellToken", () => {
  it("пропускает слова с цифрами и короткие аббревиатуры", () => {
    expect(shouldSkipSpellToken("2GIS")).toBe(true);
    expect(shouldSkipSpellToken("ОК")).toBe(true);
    expect(shouldSkipSpellToken("квартира")).toBe(false);
  });

  it("пропускает короткий ALL CAPS, длинный CAPS оставляет", () => {
    expect(shouldSkipSpellToken("а")).toBe(true);
    expect(shouldSkipSpellToken("СМС")).toBe(true);
    expect(shouldSkipSpellToken("КВАРТИРА")).toBe(false);
  });
});
