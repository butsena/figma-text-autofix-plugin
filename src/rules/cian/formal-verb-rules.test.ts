import { describe, expect, it } from "vitest";
import { getAutofixRules } from "../autofix-rules";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildFormalVerbRules } from "./formal-verb-rules";

const rules = buildFormalVerbRules();
const allRules = getAutofixRules();

describe("buildFormalVerbRules", () => {
  it("повелительное: нажми → нажмите", () => {
    expect(applyAllRules("Нажми «Продолжить»", rules)).toBe("Нажмите «Продолжить»");
  });

  it("повелительное: пиши / жди → пишите / ждите", () => {
    expect(applyAllRules("пиши нам", rules)).toBe("пишите нам");
    expect(applyAllRules("Пиши нам", rules)).toBe("Пишите нам");
    expect(applyAllRules("жди ответа", rules)).toBe("ждите ответа");
    expect(applyAllRules("Жди ответа", rules)).toBe("Ждите ответа");
  });

  it("повелительное: изучи / начни / спроси → формы на «вы»", () => {
    expect(applyAllRules("изучи объявление", rules)).toBe("изучите объявление");
    expect(applyAllRules("Начни поиск", rules)).toBe("Начните поиск");
    expect(applyAllRules("спроси у продавца", rules)).toBe("спросите у продавца");
  });

  it("настоящее: делаешь → делаете", () => {
    expect(applyAllRules("Когда делаешь — сохрани", rules)).toBe("Когда делаете — сохраните");
  });

  it("будущее: найдёшь → найдёте", () => {
    expect(applyAllRules("Скоро найдёшь квартиру", rules)).toBe("Скоро найдёте квартиру");
  });

  it("не трогает уже формальные формы", () => {
    expect(fixesFor("Нажмите кнопку", rules)).toHaveLength(0);
  });

  it("не заменяет часть другого кириллического слова", () => {
    expect(fixesFor("анажми", rules)).toHaveLength(0);
  });

  it("с местоимением: Ты можешь → Вы можете", () => {
    expect(applyAllRules("Ты можешь продолжить", allRules)).toBe("Вы можете продолжить");
  });

  it("с притяжательным: Заполни твой профиль → Заполните ваш профиль", () => {
    expect(applyAllRules("Заполни твой профиль", allRules)).toBe("Заполните ваш профиль");
  });

  it("полная фраза: Тебе нужно подтвердить → Вам нужно подтвердить", () => {
    expect(applyAllRules("Тебе нужно подтвердить", allRules)).toBe("Вам нужно подтвердить");
  });
});
