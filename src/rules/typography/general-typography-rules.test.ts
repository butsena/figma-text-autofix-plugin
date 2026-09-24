import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { applyAllRulesMultiPass } from "../../test/multi-pass";
import { getAutofixRules } from "../autofix-rules";
import { buildGeneralTypographyRules } from "./general-typography-rules";

const rules = buildGeneralTypographyRules();
const nbsp = "\u00a0";

describe("buildGeneralTypographyRules", () => {
  it("телефон РФ → стандарт Cian", () => {
    expect(applyAllRules("звоните 89991234567", rules)).toBe(
      `звоните +7${nbsp}999${nbsp}123-45-67`,
    );
  });

  it("число + единица измерения", () => {
    expect(applyAllRules("площадь 45 м²", rules)).toBe(`площадь 45${nbsp}м²`);
  });

  it("неразрывный пробел перед ₽", () => {
    expect(applyAllRules("от 100 000 ₽", rules)).toBe(`от 100 000${nbsp}₽`);
    expect(applyAllRules("от 100 000₽", rules)).toBe(`от 100 000${nbsp}₽`);
    expect(applyAllRules("от 100000₽", rules)).toBe(`от 100000${nbsp}₽`);
    expect(applyAllRules("5 ₽", rules)).toBe(`5${nbsp}₽`);
    expect(applyAllRules("5₽", rules)).toBe(`5${nbsp}₽`);
  });

  it("неразрывный пробел перед ₽ (полный пайплайн)", () => {
    const allRules = getAutofixRules();
    expect(applyAllRules("от 100 000 ₽", allRules)).toBe(`от${nbsp}100${nbsp}000${nbsp}₽`);
    expect(applyAllRules("от 100000₽", allRules)).toBe(`от${nbsp}100${nbsp}000${nbsp}₽`);
  });

  it("неразрывный пробел перед млн и тыс", () => {
    expect(applyAllRules("от 5 млн", rules)).toBe(`от 5${nbsp}млн`);
    expect(applyAllRules("от 5млн", rules)).toBe(`от 5${nbsp}млн`);
    expect(applyAllRules("1,5 млн", rules)).toBe(`1,5${nbsp}млн`);
    expect(applyAllRules("1,5млн", rules)).toBe(`1,5${nbsp}млн`);
    expect(applyAllRules("100 тыс", rules)).toBe(`100${nbsp}тыс`);
    expect(applyAllRules("100тыс", rules)).toBe(`100${nbsp}тыс`);
  });

  it("процент без пробела", () => {
    expect(
      applyAllRules("скидка 10 %", rules.filter((r) => r.id === "cian-113-percent-without-space")),
    ).toBe("скидка 10%");
  });

  it("три точки → многоточие", () => {
    expect(applyAllRules("ждём...", rules)).toBe("ждём…");
  });

  it("знак № + число", () => {
    expect(applyAllRules("договор № 123", rules)).toBe(`договор №${nbsp}123`);
  });

  it("прямые кавычки → ёлочки", () => {
    expect(applyAllRules('текст "цитата" здесь', rules)).toBe("текст «цитата» здесь");
  });

  it("тире с пробелами → длинное тире", () => {
    expect(applyAllRules("да - нет", rules)).toBe(`да${nbsp}— нет`);
  });

  it("убирает двойные пробелы", () => {
    expect(applyAllRules("слишком  много   пробелов", rules)).toBe("слишком много пробелов");
  });

  it("убирает два и более NBSP подряд", () => {
    expect(applyAllRules(`слово${nbsp}${nbsp}слово`, rules)).toBe(`слово${nbsp}слово`);
    expect(applyAllRules(`слово${nbsp}${nbsp}${nbsp}слово`, rules)).toBe(`слово${nbsp}слово`);
    expect(applyAllRules(`слово ${nbsp}слово`, rules)).toBe(`слово${nbsp}слово`);
  });

  it("схлопывает пустую строку в один перенос, не склеивая абзацы", () => {
    const input =
      "Считаем, сколько раз пользователи добавили ваши объявления в избранное:\n\nпоказываем общее количество\n• не учитываем ваши действия\n\nПоказываем на графике";
    expect(applyAllRules(input, rules)).toBe(input);
  });

  it("схлопывает три и более переноса до абзацного разрыва", () => {
    expect(applyAllRules("первый\n\n\nвторой", rules)).toBe("первый\n\nвторой");
    expect(applyAllRules("первый\n\n\n\nвторой", rules)).toBe("первый\n\nвторой");
  });

  it("сохраняет одиночные переносы в маркированном списке", () => {
    const input = "• первый пункт\n• второй пункт";
    expect(applyAllRules(input, rules)).toBe(input);
  });

  it("убирает переносы только в начале и конце", () => {
    expect(applyAllRules("\n\nтекст\n\n", rules)).toBe("текст");
  });
});

describe("модальное окно со списком (полный пайплайн)", () => {
  const modalText = `Считаем, сколько раз пользователи добавили ваши объявления в избранное:

показываем общее количество по всем объявлениям за каждый день в выбранный период
• не учитываем ваши действия: если вы добавили своё объявление в избранное, это не попадает в статистику

Показываем на графике данные по всем объявлениям за выбранный период, но не раньше марта 2024 года. Сколько раз добавили в избранное каждое отдельное объявление можно посмотреть в Моих объявлениях.

• Работало продвижение`;

  it("не склеивает абзацы и пункты списка", () => {
    const out = applyAllRules(modalText, getAutofixRules());
    expect(out).toContain("избранное:\n\nпоказываем");
    expect(out).not.toContain("избранное:показываем");
    expect(out).toContain("статистику\n\nПоказываем");
    expect(out).not.toContain("статистикуПоказываем");
    expect(out).toMatch(/• не.\s*учитываем/);
    expect(out).toContain("• Работало продвижение");
  });

  it("не склеивает при многоходовом пайплайне", () => {
    const { text: out, passes } = applyAllRulesMultiPass(modalText, getAutofixRules());
    expect(passes).toBeGreaterThan(0);
    expect(out).toContain("избранное:\n\nпоказываем");
    expect(out).not.toContain("избранное:показываем");
    expect(out).toContain("статистику\n\nПоказываем");
    expect(out).not.toContain("статистикуПоказываем");
  });

  it("не склеивает при одиночных переносах между блоками", () => {
    const singleBreak = modalText.replace(/\n\n/g, "\n");
    const { text: out } = applyAllRulesMultiPass(singleBreak, getAutofixRules());
    expect(out).toContain("избранное:\nпоказываем");
    expect(out).not.toContain("избранное:показываем");
    expect(out).toContain("статистику\nПоказываем");
    expect(out).not.toContain("статистикуПоказываем");
  });
});
