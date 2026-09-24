import { describe, expect, it } from "vitest";
import {
  casingForSuggestion,
  convertEnLayoutToRu,
  convertLatinCharsToRuLayout,
  extractLatinLayoutTokens,
  extractMixedScriptTokens,
  looksLikeRuTypedInEnLayout,
  shouldSkipLatinLayoutToken,
  suggestMixedScriptRu,
} from "./keyboard-layout";

describe("convertEnLayoutToRu", () => {
  it("переводит классические опечатки раскладки", () => {
    expect(convertEnLayoutToRu("ghbdtn")).toBe("привет");
    expect(convertEnLayoutToRu("rjvgfybz")).toBe("компания");
    expect(convertEnLayoutToRu("Ghbdtn")).toBe("Привет");
  });

  it("учитывает ; и ’ как ж/э", () => {
    expect(convertEnLayoutToRu("kjjklk’;kg")).toBe("лоолдлэжлп");
  });
});

describe("mixed script", () => {
  it("достаёт смешанные токены", () => {
    expect(extractMixedScriptTokens("1. gдоказываем общее")).toEqual([
      { word: "gдоказываем", from: 3, to: 14 },
    ]);
  });

  it("gдоказываем → доказываем (отброс случайной латиницы)", () => {
    expect(
      suggestMixedScriptRu("gдоказываем", (w) => w.toLowerCase() === "доказываем"),
    ).toBe("доказываем");
  });

  it("латиница внутри слова конвертируется по раскладке, если получается известное слово", () => {
    expect(convertLatinCharsToRuLayout("cиан")).toBe("сиан");
    expect(suggestMixedScriptRu("cиан", (w) => w.toLowerCase() === "сиан")).toBe("сиан");
  });

  it("после «1. » предлагает заглавную", () => {
    expect(casingForSuggestion("1. gдоказываем", 3, "доказываем")).toBe("Доказываем");
  });
});

describe("extractLatinLayoutTokens", () => {
  it("достаёт латинский токен с пунктуацией раскладки", () => {
    expect(extractLatinLayoutTokens("2. kjjklk’;kg рядом")).toEqual([
      { word: "kjjklk’;kg", from: 3, to: 13 },
    ]);
  });
});

describe("looksLikeRuTypedInEnLayout", () => {
  it("ловит латиницу без английских гласных", () => {
    expect(looksLikeRuTypedInEnLayout("ghbdtn")).toBe(true);
    expect(looksLikeRuTypedInEnLayout("kjjklk’;kg")).toBe(true);
    expect(looksLikeRuTypedInEnLayout("Figma")).toBe(false);
    expect(looksLikeRuTypedInEnLayout("online")).toBe(false);
  });
});

describe("shouldSkipLatinLayoutToken", () => {
  it("пропускает allowlist и короткие аббревиатуры", () => {
    expect(shouldSkipLatinLayoutToken("html")).toBe(true);
    expect(shouldSkipLatinLayoutToken("API")).toBe(true);
    expect(shouldSkipLatinLayoutToken("ok")).toBe(true);
    expect(shouldSkipLatinLayoutToken("ghbdtn")).toBe(false);
  });
});
