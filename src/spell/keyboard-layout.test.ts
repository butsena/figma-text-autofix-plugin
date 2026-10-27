import { describe, expect, it, vi } from "vitest";
import {
  casingForSuggestion,
  convertEnLayoutToRu,
  convertLatinCharsToRuLayout,
  extractLatinLayoutTokens,
  extractMixedScriptTokens,
  looksLikeRuTypedInEnLayout,
  shouldSkipLatinLayoutToken,
  suggestMixedScriptRu,
  suggestRuFromLatinLayout,
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

  it("yпишете срезает латинскую y, даже если y→н тоже «известно»", () => {
    const known = new Set(["пишете", "пишите", "нпишете", "нпишите"]);
    expect(suggestMixedScriptRu("yпишете", (w) => known.has(w.toLowerCase()))).toBe("пишете");
    expect(suggestMixedScriptRu("yпишите", (w) => known.has(w.toLowerCase()))).toBe("пишите");
  });

  it("держит ; и ’ внутри смешанного слова и не переводит абракадабру", () => {
    expect(extractMixedScriptTokens("Пункт kjjклk’;kg в списке")).toEqual([
      { word: "kjjклk’;kg", from: 6, to: 16 },
    ]);
    expect(extractMixedScriptTokens("слово, ещё")).toEqual([]);
    expect(extractMixedScriptTokens("ghbdtn,привет")).toEqual([]);
    const unknown = () => false;
    expect(suggestMixedScriptRu("kjjклk’;kg", unknown)).toBeNull();
    expect(suggestMixedScriptRu("kjjклkkg", unknown)).toBeNull();
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

describe("suggestRuFromLatinLayout", () => {
  it("не отправляет исходные слова и варианты исправления в сеть", () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    try {
      expect(suggestRuFromLatinLayout("ghbdtn", (word) => word === "привет")).toBe("привет");
      expect(suggestRuFromLatinLayout(",elbntg", (word) => word === "будите")).toBe("будите");
      suggestRuFromLatinLayout("kjjklk’;kg", () => false);
      expect(suggestRuFromLatinLayout("online", () => false)).toBeNull();
      expect(request).not.toHaveBeenCalled();
    } finally {
      request.mockRestore();
    }
  });

  it("«ghbdtn» и «,elbnt» даёт известное слово", () => {
    const known = (w: string) => ["привет", "будите"].includes(w.toLowerCase());
    expect(suggestRuFromLatinLayout("ghbdtn", known)).toBe("привет");
    expect(suggestRuFromLatinLayout(",elbnt", known)).toBe("будите");
  });

  it("лишняя клавиша в конце «,elbntg» срезается до «будите»", () => {
    const known = (w: string) => w.toLowerCase() === "будите";
    expect(suggestRuFromLatinLayout(",elbntg", known)).toBe("будите");
    expect(suggestRuFromLatinLayout("online", known)).toBeNull();
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
