import { describe, expect, it } from "vitest";
import {
  isValidImplicitSentenceBoundary,
  readTitleCaseRun,
} from "./implicit-sentence-boundary-filters";
import { IMPLICIT_SENTENCE_BOUNDARY } from "./sentence-split";

function boundaryIndex(text: string): number {
  IMPLICIT_SENTENCE_BOUNDARY.lastIndex = 0;
  const match = IMPLICIT_SENTENCE_BOUNDARY.exec(text);
  expect(match).not.toBeNull();
  return match!.index;
}

describe("readTitleCaseRun", () => {
  it("читает многословное латинское название", () => {
    expect(readTitleCaseRun("Knight Frank показывает", 0)).toEqual(["Knight", "Frank"]);
  });

  it("читает одно слово", () => {
    expect(readTitleCaseRun("Главное — текст", 0)).toEqual(["Главное"]);
  });
});

describe("isValidImplicitSentenceBoundary", () => {
  it("пропускает цепочку Title Case", () => {
    const text = "согласно отчёту Knight Frank рынок вырос";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает латиницу после кириллицы", () => {
    const text = "оплатите аренду в приложении Google Pay сегодня";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает при контексте банке", () => {
    const text = "ипотеку можно оформить в банке Сбер быстро";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает название в кавычках", () => {
    const text = "партнёр «Knight Frank» подтвердил сделку";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает фразу из списка исключений", () => {
    const text = "подключите сервис Яндекс для уведомлений";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает словоформу фразы из списка исключений", () => {
    const text = "подключите сервис Яндексе для уведомлений";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает русское сокращение из списка исключений", () => {
    const text = "подключите модуль ИИ для поиска";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(false);
  });

  it("пропускает границу внутри цепочки Title Case", () => {
    const text = "отчёту Knight Frank рынок вырос";
    IMPLICIT_SENTENCE_BOUNDARY.lastIndex = 0;
    const matches = [...text.matchAll(IMPLICIT_SENTENCE_BOUNDARY)];
    const knightFrankGap = matches.find((m) => text.slice(m.index, m.index + 20).includes("Knight Frank"));
    expect(knightFrankGap).toBeDefined();
    expect(isValidImplicitSentenceBoundary(text, knightFrankGap!.index)).toBe(false);
  });

  it("оставляет границу для по запросу Главное", () => {
    const text = "цену скину вам в смс по запросу Главное — сохраните";
    const index = boundaryIndex(text);
    expect(isValidImplicitSentenceBoundary(text, index)).toBe(true);
  });
});
