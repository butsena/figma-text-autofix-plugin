import { describe, expect, it } from "vitest";
import { applyAllRules, applyProposedFixes, fixByRuleId } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildSentenceCapitalizationRules } from "./sentence-capitalization-rules";

const rules = buildSentenceCapitalizationRules();
const allRules = getAutofixRules();

function applyCaps(text: string): string {
  return applyProposedFixes(text, rules);
}

describe("buildSentenceCapitalizationRules", () => {
  it("регистр только confirm, не auto", () => {
    expect(rules.every((r) => r.applyPolicy === "confirm")).toBe(true);
    expect(applyAllRules("заполни профиль", rules)).toBe("заполни профиль");
    expect(applyCaps("заполни профиль")).toBe("Заполни профиль");
  });

  it("заглавная в начале текста", () => {
    expect(applyCaps("заполни профиль")).toBe("Заполни профиль");
  });

  it("заглавная после точки", () => {
    expect(applyCaps("Привет. как дела")).toBe("Привет. Как дела");
  });

  it("заглавная после вопросительного и восклицательного знака", () => {
    expect(applyCaps("Готово? отлично")).toBe("Готово? Отлично");
    expect(applyCaps("Стоп! продолжим")).toBe("Стоп! Продолжим");
  });

  it("заглавная после многоточия", () => {
    expect(applyCaps("ждём… продолжение")).toBe("Ждём… Продолжение");
  });

  it("заглавная после перевода строки", () => {
    expect(applyCaps("первая строка\nвторая строка")).toBe(
      "Первая строка\nвторая строка",
    );
  });

  it("не меняет строку после переноса (исключение)", () => {
    expect(applyCaps("Заголовок\nподзаголовок")).toBe("Заголовок\nподзаголовок");
  });

  it("не меняет пункты маркированного списка", () => {
    expect(applyCaps("• первый пункт\n• второй пункт")).toBe(
      "• первый пункт\n• второй пункт",
    );
    expect(applyCaps("- первый\n— второй")).toBe("- первый\n— второй");
  });

  it("ставит заглавную в пунктах нумерованного списка", () => {
    expect(applyCaps("1. первый пункт")).toBe("1. Первый пункт");
    expect(applyCaps("1) первый")).toBe("1) Первый");
    expect(applyCaps("1. первый пункт\n2. второй пункт")).toBe(
      "1. Первый пункт\n2. Второй пункт",
    );
    expect(applyCaps("10. десятый пункт")).toBe("10. Десятый пункт");
  });

  it("ставит заглавную в нумерованном пункте после двоеточия без перевода строки", () => {
    expect(
      applyCaps(
        "Считаем, сколько раз пользователи добавили ваши объявления в избранное: 1. показываем общее количество по всем объявлениям",
      ),
    ).toBe(
      "Считаем, сколько раз пользователи добавили ваши объявления в избранное: 1. Показываем общее количество по всем объявлениям",
    );
    expect(applyCaps("избранное:\u00A01. показываем")).toBe(
      "Избранное:\u00A01. Показываем",
    );
  });

  it("ставит заглавную после Unicode-разделителя строк", () => {
    expect(applyCaps("избранное:\u20281. показываем")).toBe(
      "Избранное:\u20281. Показываем",
    );
  });

  it("ставит заглавную в нумерованном пункте после мягкого переноса без \\n", () => {
    expect(
      applyCaps("за каждый день в выбранный период 2. домище картер"),
    ).toBe("За каждый день в выбранный период 2. Домище картер");
  });

  it("не капитализирует нумерованный пункт в середине фразы", () => {
    expect(applyCaps("см. 1. пункт ниже")).toBe("См. 1. пункт ниже");
  });

  it("не меняет адрес электронной почты", () => {
    expect(applyCaps("info@example.com")).toBe("info@example.com");
    expect(applyCaps("Напишите info@example.com. мы ответим")).toBe(
      "Напишите info@example.com. Мы ответим",
    );
  });

  it("заглавная после открывающей кавычки", () => {
    expect(applyCaps("«привет»")).toBe("«Привет»");
  });

  it("заглавная после пробелов в начале текста", () => {
    expect(applyCaps("  привет")).toBe("  Привет");
  });

  it("буква ё в начале предложения", () => {
    expect(applyCaps("ёлка зелёная")).toBe("Ёлка зелёная");
  });

  it("латиница в начале и после точки", () => {
    expect(applyCaps("email. world")).toBe("Email. World");
  });

  it("не меняет середину предложения", () => {
    expect(applyCaps("Уже одно предложение без правок")).toBe(
      "Уже одно предложение без правок",
    );
  });

  it("не меняет уже заглавную букву", () => {
    expect(applyCaps("Уже правильно")).toBe("Уже правильно");
  });

  it("в полном пайплайне auto не ставит заглавную", () => {
    expect(applyAllRules("заполни твой профиль", allRules)).toBe("заполните ваш профиль");
    expect(applyProposedFixes("заполни твой профиль", allRules)).toBe("Заполните ваш профиль");
  });

  it("ставит заглавную при переводах строки \\r (как в Figma)", () => {
    expect(
      applyCaps("но ищете:\r1. показываем общее\r2. подп картер"),
    ).toBe("Но ищете:\r1. Показываем общее\r2. Подп картер");
  });

  it("ставит заглавную в пунктах после «:» как на скрине (с \\n и без)", () => {
    expect(
      applyCaps(
        "но ищете:\n1. показываем общее количество по всем объявлениям за каждый день в выбранный период\n2. подп картер",
      ),
    ).toBe(
      "Но ищете:\n1. Показываем общее количество по всем объявлениям за каждый день в выбранный период\n2. Подп картер",
    );
    expect(
      applyCaps(
        "но ищете: 1. показываем общее количество по всем объявлениям за каждый день в выбранный период 2. подп картер",
      ),
    ).toBe(
      "Но ищете: 1. Показываем общее количество по всем объявлениям за каждый день в выбранный период 2. Подп картер",
    );
  });

  it("находит правку по id", () => {
    const fixes = applyCaps("привет. мир");
    expect(fixes).toBe("Привет. Мир");
    const fix = fixByRuleId("привет. мир", rules, "cian-138-sentence-start-capitalize");
    expect(fix?.before).toBe("п");
    expect(fix?.after).toBe("П");
  });

  it("нумерованный список даёт правку по своему id", () => {
    const fix = fixByRuleId("1. показываем", rules, "cian-138-numbered-list-capitalize");
    expect(fix?.after).toContain("П");
  });
});
