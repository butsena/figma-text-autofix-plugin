import { describe, expect, it } from "vitest";
import { matchesBoundaryExceptionAt, parseBoundaryExceptions } from "./boundary-exceptions-data";

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
});
