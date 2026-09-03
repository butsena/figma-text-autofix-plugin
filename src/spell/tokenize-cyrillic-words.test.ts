import { describe, expect, it } from "vitest";
import { extractCyrillicWordTokens, shouldSkipSpellToken } from "./tokenize-cyrillic-words";

describe("extractCyrillicWordTokens", () => {
  it("находит кириллические слова с позициями", () => {
    expect(extractCyrillicWordTokens("Кватира в доме")).toEqual([
      { word: "Кватира", from: 0, to: 7 },
      { word: "доме", from: 10, to: 14 },
    ]);
  });
});

describe("shouldSkipSpellToken", () => {
  it("пропускает слова с цифрами и короткие аббревиатуры", () => {
    expect(shouldSkipSpellToken("2GIS")).toBe(true);
    expect(shouldSkipSpellToken("ОК")).toBe(true);
    expect(shouldSkipSpellToken("квартира")).toBe(false);
  });
});
