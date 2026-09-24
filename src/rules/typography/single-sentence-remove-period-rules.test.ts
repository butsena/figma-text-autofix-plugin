import { describe, expect, it } from "vitest";
import { applyTextFixes } from "../../core/autofix-engine";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildImplicitSentencePeriodRules } from "./implicit-sentence-period-rules";
import { buildSentenceTerminalPeriodRules } from "./sentence-terminal-period-rules";
import { buildSingleSentenceRemovePeriodRules } from "./single-sentence-remove-period-rules";
import { removeSingleSentenceTerminalPeriod } from "./sentence-split";

const rules = buildSingleSentenceRemovePeriodRules();
const terminalRules = buildSentenceTerminalPeriodRules();
const implicitRules = buildImplicitSentencePeriodRules();
const allRules = getAutofixRules();

describe("removeSingleSentenceTerminalPeriod", () => {
  it("убирает точку в одном предложении", () => {
    expect(removeSingleSentenceTerminalPeriod("Заполните профиль.")).toBe("Заполните профиль");
    expect(removeSingleSentenceTerminalPeriod("Заполните профиль. ")).toBe("Заполните профиль ");
  });

  it("не трогает одно предложение без точки", () => {
    expect(removeSingleSentenceTerminalPeriod("Заполните профиль")).toBe("Заполните профиль");
  });

  it("не трогает несколько предложений", () => {
    expect(removeSingleSentenceTerminalPeriod("Первое. Второе.")).toBe("Первое. Второе.");
    expect(removeSingleSentenceTerminalPeriod("Первое. Второе")).toBe("Первое. Второе");
  });

  it("не трогает ! и ?", () => {
    expect(removeSingleSentenceTerminalPeriod("Готово!")).toBe("Готово!");
    expect(removeSingleSentenceTerminalPeriod("Что дальше?")).toBe("Что дальше?");
  });

  it("не трогает маркированный список", () => {
    expect(removeSingleSentenceTerminalPeriod("• первый.")).toBe("• первый.");
  });

  it("не путает сокращения с несколькими точками", () => {
    expect(removeSingleSentenceTerminalPeriod("см. 1. пункт ниже.")).toBe("см. 1. пункт ниже.");
  });
});

describe("buildSingleSentenceRemovePeriodRules", () => {
  it("применяет правило через движок", () => {
    expect(applyAllRules("Заполните профиль.", rules)).toBe("Заполните профиль");
  });

  it("сообщение в отчёте", () => {
    const [fix] = fixesFor("Заполните профиль.", rules);
    expect(fix).toMatchObject({
      message: "Редполитика: одно предложение, точка не нужна",
      ruleId: "cian-139b-single-sentence-remove-period",
    });
    expect(applyAllRules("Заполните профиль.", rules)).toBe("Заполните профиль");
  });
});

describe("конфликт с правилом точки в конце нескольких предложений", () => {
  it("добавляет точки при нескольких предложениях и не снимает их", () => {
    expect(applyAllRules("Первое. Второе", allRules)).toBe("Первое. Второе.");
    expect(applyAllRules("Первое. Второе.", allRules)).toBe("Первое. Второе.");
  });

  it("снимает лишнюю точку только у одного предложения", () => {
    expect(applyAllRules("Заполните профиль.", allRules)).toBe("Заполните профиль");
  });
});

describe("конфликт с неявной точкой в середине текста", () => {
  it("не снимает точку, добавленную между предложениями", () => {
    const input =
      "Любого слона можно купить онлайн — цену скину вам в смс по запросу Главное — сохраните ваш профиль.";
    let text = input;
    let confirmFixes = fixesFor(text, implicitRules);
    while (confirmFixes.length > 0) {
      text = applyTextFixes(text, [confirmFixes[0]!]);
      confirmFixes = fixesFor(text, implicitRules);
    }
    text = applyAllRules(text, terminalRules);
    text = applyAllRules(text, rules);
    expect(text).toMatch(/запросу\.\s+Главное/);
    expect(text.endsWith(".")).toBe(true);
  });

  it("неявная точка не мешает снять точку у одного предложения", () => {
    const input = "Заполните профиль.";
    expect(fixesFor(input, implicitRules)).toHaveLength(0);
    expect(applyAllRules(input, allRules)).toBe("Заполните профиль");
  });
});
