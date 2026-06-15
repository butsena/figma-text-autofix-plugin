import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildFormalPronounRules } from "./formal-pronoun-rules";

const rules = buildFormalPronounRules();

describe("buildFormalPronounRules", () => {
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
});
