import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../test/helpers";
import { buildFormalVerbRules } from "./cian/formal-verb-rules";
import { buildCianBrandRules } from "./cian/brand-rules";
import { buildFormalPronounRules } from "./cian/formal-pronoun-rules";
import { buildSmsRules } from "./cian/sms-rules";
import { buildEYoRules } from "./e-yo-rules";
import { buildSentenceCapitalizationRules } from "./typography/sentence-capitalization-rules";
import { buildServiceWordNbspRules } from "./typography/service-word-nbsp-rules";

/**
 * В Figma delete/insert по диапазону fix сбрасывает стиль символов внутри диапазона.
 * Движок сужает fix до реально меняющейся части — здесь проверяем, что префиксы
 * (пробелы, предлоги) не попадают в before/after.
 */
describe("диапазон замены не захватывает неизменный префикс (стили в Figma)", () => {
  it("SMS: только слово", () => {
    const [fix] = fixesFor("в SMS", buildSmsRules());
    expect(fix).toMatchObject({ before: "SMS", after: "смс", from: 2, to: 5 });
  });

  it("ё: только слово (пробел перед ним вне диапазона)", () => {
    const [fix] = fixesFor("в подтвержден", buildEYoRules());
    expect(fix).toMatchObject({ before: "подтвержден", after: "подтверждён", from: 2 });
  });

  it("Вы/вас: только местоимение", () => {
    const [fix] = fixesFor("ждём Вас", buildFormalPronounRules());
    expect(fix).toMatchObject({ before: "Вас", after: "вас", from: 5, to: 8 });
  });

  it("твой: только слово", () => {
    const [fix] = fixesFor("Заполни твой профиль", buildFormalPronounRules()).filter(
      (f) => f.before === "твой",
    );
    expect(fix).toMatchObject({ before: "твой", after: "ваш", from: 8, to: 12 });
  });

  it("Заполни: только суффикс и → ите", () => {
    const fix = fixesFor("Заполни твой профиль", buildFormalVerbRules()).find(
      (f) => f.before === "и" && f.after === "ите",
    );
    expect(fix).toMatchObject({ from: 6, to: 7, before: "и", after: "ите" });
  });

  it("ЦИАН: только бренд", () => {
    const [fix] = fixesFor("на ЦИАН", buildCianBrandRules());
    expect(fix).toMatchObject({ before: "ЦИАН", after: "Циан", from: 3, to: 7 });
  });

  it("сохраните: только первая буква с → С", () => {
    const [fix] = fixesFor("сохраните файл", buildSentenceCapitalizationRules());
    expect(fix).toMatchObject({ from: 0, to: 1, before: "с", after: "С" });
  });

  it("служебное слово: меняется только пробел после «в»", () => {
    const nbsp = "\u00a0";
    const fixes = fixesFor("зайдите в дом", buildServiceWordNbspRules());
    const nbspFix = fixes.find((f) => f.ruleId === "cian-095-nbsp-в");
    expect(nbspFix).toMatchObject({ before: " ", after: nbsp, from: 9, to: 10 });
  });

  it("итоговый текст тот же, что и при полной замене", () => {
    expect(applyAllRules("в SMS", buildSmsRules())).toBe("в смс");
    expect(applyAllRules("ждём Вас", buildFormalPronounRules())).toBe("ждём вас");
  });
});
