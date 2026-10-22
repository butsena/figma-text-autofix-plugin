import { describe, expect, it } from "vitest";
import { parseBoundaryExceptions } from "../../lexicon/boundary-exceptions-parse";
import { matchesBoundaryExceptionAt } from "./boundary-exception-match";

describe("parseBoundaryExceptions", () => {
  it("парсит фразы и сортирует длинные первыми", () => {
    expect(parseBoundaryExceptions("Яндекс\nKnight Frank\nИИ\n# коммент")).toEqual([
      "Knight Frank",
      "Яндекс",
      "ИИ",
    ]);
  });
});

describe("matchesBoundaryExceptionAt", () => {
  const phrases = ["Knight Frank", "Яндекс", "ИИ"];

  it("находит многословную фразу", () => {
    expect(matchesBoundaryExceptionAt("отчёт Knight Frank показал", 6, phrases)).toBe(true);
  });

  it("находит сокращение", () => {
    expect(matchesBoundaryExceptionAt("сервис ИИ помогает", 7, phrases)).toBe(true);
  });

  it("не путает префикс с полной фразой", () => {
    expect(matchesBoundaryExceptionAt("Knightliness", 0, phrases)).toBe(false);
  });

  it("принимает падеж кириллической фразы", () => {
    const brands = ["Циан", "Яндекс", "Сбер", "Сбербанк"];
    expect(matchesBoundaryExceptionAt("На Циане сегодня", 3, brands)).toBe(true);
    expect(matchesBoundaryExceptionAt("для Циана", 4, brands)).toBe(true);
    expect(matchesBoundaryExceptionAt("с Цианом", 2, brands)).toBe(true);
    expect(matchesBoundaryExceptionAt("о Яндексе", 2, brands)).toBe(true);
    expect(matchesBoundaryExceptionAt("со Сбербанком", 3, brands)).toBe(true);
  });

  it("не принимает хвост длиннее окончания", () => {
    const brands = ["Циан", "Сбер", "ИИ"];
    expect(matchesBoundaryExceptionAt("цианид", 0, brands)).toBe(false);
    expect(matchesBoundaryExceptionAt("сбережения", 0, brands)).toBe(false);
    expect(matchesBoundaryExceptionAt("ИИшка", 0, brands)).toBe(false);
  });

  it("не склоняет латинскую фразу", () => {
    expect(matchesBoundaryExceptionAt("Knight Frankа", 0, phrases)).toBe(false);
  });
});
