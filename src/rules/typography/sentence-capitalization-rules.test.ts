import { describe, expect, it } from "vitest";
import { applyAllRules, fixByRuleId } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildSentenceCapitalizationRules } from "./sentence-capitalization-rules";

const rules = buildSentenceCapitalizationRules();
const allRules = getAutofixRules();

describe("buildSentenceCapitalizationRules", () => {
  it("заглавная в начале текста", () => {
    expect(applyAllRules("заполни профиль", rules)).toBe("Заполни профиль");
  });

  it("заглавная после точки", () => {
    expect(applyAllRules("Привет. как дела", rules)).toBe("Привет. Как дела");
  });

  it("заглавная после вопросительного и восклицательного знака", () => {
    expect(applyAllRules("Готово? отлично", rules)).toBe("Готово? Отлично");
    expect(applyAllRules("Стоп! продолжим", rules)).toBe("Стоп! Продолжим");
  });

  it("заглавная после многоточия", () => {
    expect(applyAllRules("ждём… продолжение", rules)).toBe("Ждём… Продолжение");
  });

  it("заглавная после перевода строки", () => {
    expect(applyAllRules("первая строка\nвторая строка", rules)).toBe(
      "Первая строка\nвторая строка",
    );
  });

  it("не меняет строку после переноса (исключение)", () => {
    expect(applyAllRules("Заголовок\nподзаголовок", rules)).toBe("Заголовок\nподзаголовок");
  });

  it("не меняет пункты маркированного списка", () => {
    expect(applyAllRules("• первый пункт\n• второй пункт", rules)).toBe(
      "• первый пункт\n• второй пункт",
    );
    expect(applyAllRules("- первый\n— второй", rules)).toBe("- первый\n— второй");
  });

  it("ставит заглавную в пунктах нумерованного списка", () => {
    expect(applyAllRules("1. первый пункт", rules)).toBe("1. Первый пункт");
    expect(applyAllRules("1) первый", rules)).toBe("1) Первый");
    expect(applyAllRules("1. первый пункт\n2. второй пункт", rules)).toBe(
      "1. Первый пункт\n2. Второй пункт",
    );
    expect(applyAllRules("10. десятый пункт", rules)).toBe("10. Десятый пункт");
  });

  it("не капитализирует нумерованный пункт в середине фразы", () => {
    expect(applyAllRules("см. 1. пункт ниже", rules)).toBe("См. 1. пункт ниже");
  });

  it("не меняет адрес электронной почты", () => {
    expect(applyAllRules("info@example.com", rules)).toBe("info@example.com");
    expect(applyAllRules("Напишите info@example.com. мы ответим", rules)).toBe(
      "Напишите info@example.com. Мы ответим",
    );
  });

  it("заглавная после открывающей кавычки", () => {
    expect(applyAllRules("«привет»", rules)).toBe("«Привет»");
  });

  it("заглавная после пробелов в начале текста", () => {
    expect(applyAllRules("  привет", rules)).toBe("  Привет");
  });

  it("буква ё в начале предложения", () => {
    expect(applyAllRules("ёлка зелёная", rules)).toBe("Ёлка зелёная");
  });

  it("латиница в начале и после точки", () => {
    expect(applyAllRules("email. world", rules)).toBe("Email. World");
  });

  it("не меняет середину предложения", () => {
    expect(applyAllRules("Уже одно предложение без правок", rules)).toBe(
      "Уже одно предложение без правок",
    );
  });

  it("не меняет уже заглавную букву", () => {
    expect(applyAllRules("Уже правильно", rules)).toBe("Уже правильно");
  });

  it("в полном пайплайне: заполни → Заполните", () => {
    expect(applyAllRules("заполни твой профиль", allRules)).toBe("Заполните ваш профиль");
  });

  it("находит правку по id", () => {
    const fixes = applyAllRules("привет. мир", rules);
    expect(fixes).toBe("Привет. Мир");
    const fix = fixByRuleId("привет. мир", rules, "cian-138-sentence-start-capitalize");
    expect(fix?.before).toBe("п");
    expect(fix?.after).toBe("П");
  });
});
