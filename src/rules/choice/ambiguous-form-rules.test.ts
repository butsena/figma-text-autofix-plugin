import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildAmbiguousFormChoiceRules } from "./ambiguous-form-rules";

const rules = buildAmbiguousFormChoiceRules();
const allRules = getAutofixRules();

describe("buildAmbiguousFormChoiceRules", () => {
  it("предлагает выбор для ищите", () => {
    const [fix] = fixesFor("ищите квартиру", rules);
    expect(fix).toMatchObject({
      applyPolicy: "choice",
      before: "ищите",
      after: "ищите",
      choiceOptions: ["ищите", "ищете"],
      message: "Выберите форму глагола",
    });
  });

  it("предлагает выбор для ищете", () => {
    const [fix] = fixesFor("ищете квартиру", rules);
    expect(fix).toMatchObject({
      applyPolicy: "choice",
      before: "ищете",
      after: "ищете",
      choiceOptions: ["ищите", "ищете"],
    });
  });

  it("не применяется автоматически", () => {
    expect(applyAllRules("ищите квартиру", allRules).toLowerCase()).toContain("ищите");
    expect(applyAllRules("ищете квартиру", allRules).toLowerCase()).toContain("ищете");
  });

  it("сохраняет найденное слово с заглавной", () => {
    const [fix] = fixesFor("Ищите квартиру", rules);
    expect(fix?.before).toBe("Ищите");
  });

  it("предлагает выбор для все", () => {
    const [fix] = fixesFor("проверьте все варианты", rules);
    expect(fix).toMatchObject({
      applyPolicy: "choice",
      before: "все",
      after: "все",
      choiceOptions: ["все", "всё"],
      message: "Выберите букву",
      hint: "по редполитике Циана мы пишем ё там, где это требуется",
    });
  });

  it("предлагает выбор для всё", () => {
    const [fix] = fixesFor("всё готово", rules);
    expect(fix).toMatchObject({
      applyPolicy: "choice",
      before: "всё",
      after: "всё",
      choiceOptions: ["все", "всё"],
    });
  });

  it("не применяет все/всё автоматически", () => {
    expect(applyAllRules("проверьте все варианты", allRules)).toContain("все");
    expect(applyAllRules("уже всё готово", allRules)).toContain("всё");
  });

  it("сохраняет регистр для все/всё", () => {
    const [fix] = fixesFor("Все варианты", rules);
    expect(fix?.before).toBe("Все");
  });

  it("предлагает выбор для ждёте и е-написания ждете", () => {
    const yo = fixesFor("вы ждёте ключи", rules);
    expect(yo).toMatchObject([
      {
        applyPolicy: "choice",
        before: "ждёте",
        choiceOptions: ["ждите", "ждёте"],
        ruleId: "cian-choice-zhdite-zhdyote",
      },
    ]);

    const ye = fixesFor("вы ждете ключи", rules);
    expect(ye).toMatchObject([
      {
        applyPolicy: "choice",
        before: "ждете",
        choiceOptions: ["ждите", "ждёте"],
        ruleId: "cian-choice-zhdite-zhdyote",
      },
    ]);
  });

  it("находит все choice-формы в смешанной фразе, включая е вместо ё", () => {
    const text =
      "Привяжите номер телефона, онлайн не всё потерять доступ пишете квартиру ждете online ₽ Риэлтору";
    const choiceFixes = fixesFor(text, allRules).filter((fix) => fix.applyPolicy === "choice");
    expect(choiceFixes.map((fix) => [fix.ruleId, fix.before])).toEqual([
      ["cian-choice-vse-vsyo", "всё"],
      ["cian-choice-pishite-pishete", "пишете"],
      ["cian-choice-zhdite-zhdyote", "ждете"],
    ]);
  });
});
