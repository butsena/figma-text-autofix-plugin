import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildServiceWordNbspRules } from "./service-word-nbsp-rules";

const rules = buildServiceWordNbspRules();
const nbsp = "\u00a0";

const userText =
  "Будем продлевать публикацию каждые 30 дней за 2 886 ₽, пока не\nотключите. Стоимость списывается с баланса, если не хватит —\nс сохранённой карты.";

describe("buildServiceWordNbspRules", () => {
  it("неразрывный пробел после «и»", () => {
    expect(applyAllRules("квартира и дом", rules)).toBe(`квартира и${nbsp}дом`);
  });

  it("неразрывный пробел после «в»", () => {
    expect(applyAllRules("оплата в банке", rules)).toBe(`оплата в${nbsp}банке`);
  });

  it("неразрывный пробел после «не» перед глаголом", () => {
    expect(applyAllRules("не отключите", rules)).toBe(`не${nbsp}отключите`);
  });

  it("неразрывный пробел после «не» в цепочке служебных слов", () => {
    expect(applyAllRules("если не хватит", rules)).toBe(`если${nbsp}не${nbsp}хватит`);
    expect(applyAllRules("пока не отключите", rules)).toBe(`пока${nbsp}не${nbsp}отключите`);
  });

  it("склеивает служебное слово со следующим через перенос строки", () => {
    expect(applyAllRules("пока не\nотключите", rules)).toBe(`пока${nbsp}не${nbsp}отключите`);
  });

  it("не трогает «и» внутри слова", () => {
    expect(fixesFor("иван", rules)).toHaveLength(0);
  });

  it("не трогает «а» в конце слова «квартира»", () => {
    expect(applyAllRules("квартира и дом", rules)).toBe(`квартира и${nbsp}дом`);
  });

  it("обрабатывает пользовательский фрагмент про продление публикации", () => {
    const out = applyAllRules(userText, rules);
    expect(out).toContain(`пока${nbsp}не${nbsp}отключите`);
    expect(out).toContain(`если${nbsp}не${nbsp}хватит`);
    expect(out).not.toMatch(/не\r?\nотключите/);
  });

  it("меняет только пробел после «в» в fix range", () => {
    const nbspFix = fixesFor("зайдите в дом", rules).find((f) => f.ruleId === "cian-095-nbsp-в");
    expect(nbspFix).toMatchObject({ before: " ", after: nbsp, from: 9, to: 10 });
  });

  it("неразрывный пробел после «от» в полном пайплайне", () => {
    const allRules = getAutofixRules();
    expect(applyAllRules("от 100 000 ₽", allRules)).toBe(`от${nbsp}100${nbsp}000${nbsp}₽`);
  });
});
