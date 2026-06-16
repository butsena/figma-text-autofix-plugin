import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import {
  ensureSentenceTerminalPeriods,
  normalizeSpaceAfterSentenceEnd,
  splitIntoSentenceFragments,
} from "./sentence-split";
import { buildSentenceTerminalPeriodRules } from "./sentence-terminal-period-rules";

const rules = buildSentenceTerminalPeriodRules();
const allRules = getAutofixRules();

describe("normalizeSpaceAfterSentenceEnd", () => {
  it("вставляет пробел после точки перед следующим предложением", () => {
    expect(normalizeSpaceAfterSentenceEnd("Первое.Второе")).toBe("Первое. Второе");
    expect(normalizeSpaceAfterSentenceEnd("First.Second")).toBe("First. Second");
  });

  it("не трогает домены и нумерованные пункты", () => {
    expect(normalizeSpaceAfterSentenceEnd("info@example.com")).toBe("info@example.com");
    expect(normalizeSpaceAfterSentenceEnd("см. 1. пункт")).toBe("см. 1. пункт");
  });

  it("вставляет пробел после ! и ?", () => {
    expect(normalizeSpaceAfterSentenceEnd("Готово!Спасибо")).toBe("Готово! Спасибо");
    expect(normalizeSpaceAfterSentenceEnd("Что?Дальше")).toBe("Что? Дальше");
  });
});

describe("splitIntoSentenceFragments", () => {
  it("делит по . ! ? …", () => {
    expect(splitIntoSentenceFragments("А. Б! В? Г… Д")).toEqual(["А.", " Б!", " В?", " Г…", " Д"]);
  });
});

describe("ensureSentenceTerminalPeriods", () => {
  it("не ставит точку в одном предложении", () => {
    expect(ensureSentenceTerminalPeriods("Заполните профиль")).toBe("Заполните профиль");
    expect(ensureSentenceTerminalPeriods("What next")).toBe("What next");
    expect(ensureSentenceTerminalPeriods("Готово!")).toBe("Готово!");
    expect(ensureSentenceTerminalPeriods("Что дальше?")).toBe("Что дальше?");
  });

  it("ставит точку в конце каждого предложения при нескольких", () => {
    expect(ensureSentenceTerminalPeriods("Заполните профиль. Продолжите")).toBe(
      "Заполните профиль. Продолжите.",
    );
    expect(ensureSentenceTerminalPeriods("Готово! Спасибо")).toBe("Готово! Спасибо.");
    expect(ensureSentenceTerminalPeriods("Что дальше? Мы поможем")).toBe("Что дальше? Мы поможем.");
    expect(ensureSentenceTerminalPeriods("Шаг 1: текст. Шаг 2: текст")).toBe(
      "Шаг 1: текст. Шаг 2: текст.",
    );
  });

  it("нормализует пробел и ставит точки", () => {
    expect(ensureSentenceTerminalPeriods("Первое.Второе")).toBe("Первое. Второе.");
    expect(ensureSentenceTerminalPeriods("Done!Thanks")).toBe("Done! Thanks.");
  });

  it("не меняет уже завершённые предложения", () => {
    expect(ensureSentenceTerminalPeriods("Первое. Второе.")).toBe("Первое. Второе.");
    expect(ensureSentenceTerminalPeriods("Готово! Всё ок.")).toBe("Готово! Всё ок.");
  });

  it("не трогает перенос строки как границу одного предложения", () => {
    expect(ensureSentenceTerminalPeriods("Заголовок\nподзаголовок")).toBe("Заголовок\nподзаголовок");
  });

  it("не трогает маркированный и нумерованный список", () => {
    expect(ensureSentenceTerminalPeriods("• первый\n• второй")).toBe("• первый\n• второй");
    expect(ensureSentenceTerminalPeriods("1. первый\n2. второй")).toBe("1. первый\n2. второй");
  });

  it("не трогает example.com и 1. пункт", () => {
    expect(ensureSentenceTerminalPeriods("Напишите info@example.com")).toBe(
      "Напишите info@example.com",
    );
    expect(ensureSentenceTerminalPeriods("см. 1. пункт ниже")).toBe("см. 1. пункт ниже");
  });
});

describe("buildSentenceTerminalPeriodRules", () => {
  it("применяет правило через движок", () => {
    expect(applyAllRules("Первое. Второе", rules)).toBe("Первое. Второе.");
  });

  it("в полном пайплайне после капитализации", () => {
    expect(applyAllRules("первое. второе", allRules)).toBe("Первое. Второе.");
  });
});
