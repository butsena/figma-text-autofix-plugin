import { describe, expect, it } from "vitest";
import { applyTextFixes } from "../../core/autofix-engine";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildFormalPronounRules } from "./formal-pronoun-rules";

const rules = buildFormalPronounRules();
const allRules = getAutofixRules();

describe("buildFormalPronounRules", () => {
  it("ты → вы в середине предложения", () => {
    expect(applyAllRules("Мы знаем, что ты прав", rules)).toBe("Мы знаем, что вы прав");
  });

  it("Ты → Вы в начале текста", () => {
    expect(applyAllRules("Ты можешь продолжить", rules)).toBe("Вы можешь продолжить");
  });

  it("Ты → Вы после точки", () => {
    expect(applyAllRules("Спасибо. Ты можешь продолжить", rules)).toBe(
      "Спасибо. Вы можешь продолжить",
    );
  });

  it("ты → Вы после перевода строки", () => {
    expect(applyAllRules("Спасибо.\nты можешь продолжить", rules)).toBe(
      "Спасибо.\nВы можешь продолжить",
    );
  });

  it("не трогает ты внутри слова", () => {
    expect(fixesFor("свойства", rules)).toHaveLength(0);
  });

  it("тебя → вас в середине предложения", () => {
    expect(applyAllRules("Мы ждём тебя", rules)).toBe("Мы ждём вас");
  });

  it("тебе → вам", () => {
    expect(applyAllRules("Напиши, если тебе удобно", rules)).toBe("Напиши, если вам удобно");
  });

  it("тобой → вами", () => {
    expect(applyAllRules("Довольны тобой", rules)).toBe("Довольны вами");
  });

  it("твой → ваш в середине предложения", () => {
    expect(applyAllRules("Заполни твой профиль", rules)).toBe("Заполни ваш профиль");
  });

  it("твой → ваш: только слово в диапазоне замены", () => {
    const [fix] = fixesFor("Заполни твой профиль", rules).filter((f) => f.before === "твой");
    expect(fix).toMatchObject({ before: "твой", after: "ваш", from: 8, to: 12 });
  });

  it("Твой → Ваш в начале предложения", () => {
    expect(applyAllRules("Твой профиль готов", rules)).toBe("Ваш профиль готов");
  });

  it("твоём → вашем", () => {
    expect(applyAllRules("В твоём аккаунте", rules)).toBe("В вашем аккаунте");
  });

  it("твоем → вашем (без ё)", () => {
    expect(applyAllRules("В твоем аккаунте", rules)).toBe("В вашем аккаунте");
  });

  it("в середине предложения: Вас → вас", () => {
    expect(applyAllRules("Мы ждём Вас", rules)).toBe("Мы ждём вас");
  });

  it("притяжательное: Ваш → ваш", () => {
    expect(applyAllRules("заполните Ваш профиль", rules)).toBe("заполните ваш профиль");
  });

  it("не трогает Вы в начале текста", () => {
    expect(fixesFor("Вы можете продолжить", rules)).toHaveLength(0);
  });

  it("не трогает Вы после точки (новое предложение)", () => {
    expect(fixesFor("Спасибо. Вы можете продолжить", rules)).toHaveLength(0);
  });

  it("строчная «Вы/Ваш» в середине — auto", () => {
    const [fix] = fixesFor("Мы ждём Вас", rules);
    expect(fix?.ruleId).toBe("cian-formal-pronoun-lowercase");
    expect(fix?.applyPolicy).toBe("auto");
  });

  it("если Вы — продолжение фразы, строчная auto", () => {
    expect(applyAllRules("напишите, если Вы хотите", rules)).toBe(
      "напишите, если вы хотите",
    );
  });

  it("не понижает «Вы» после слова из 4+ букв — похоже на новое предложение без точки", () => {
    const text = "Сохраните профиль Вы можете продолжить";
    expect(applyAllRules(text, rules)).toBe(text);
    expect(
      fixesFor(text, rules).filter((f) => f.ruleId === "cian-formal-pronoun-lowercase"),
    ).toHaveLength(0);
  });

  it("после auto «Вы» на неявной границе остаётся для confirm-точки", () => {
    const text = "Сохраните профиль Вы можете продолжить";
    const afterAuto = applyAllRules(text, allRules);
    expect(afterAuto).toContain("Вы можете");
    expect(afterAuto).not.toContain("вы можете");
    const period = fixesFor(afterAuto, allRules).find(
      (f) => f.ruleId === "cian-139a-implicit-sentence-period",
    );
    expect(period).toBeDefined();
    expect(applyTextFixes(afterAuto, [period!])).toContain("профиль. Вы");
  });

  it("ждём Вас: auto-строчная снимает ложную confirm-точку", () => {
    const afterAuto = applyAllRules("Мы ждём Вас", allRules);
    expect(afterAuto).toBe("Мы ждём вас");
    expect(
      fixesFor(afterAuto, allRules).filter(
        (f) => f.ruleId === "cian-139a-implicit-sentence-period",
      ),
    ).toHaveLength(0);
  });
});
