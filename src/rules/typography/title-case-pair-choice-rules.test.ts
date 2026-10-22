import { describe, expect, it } from "vitest";
import { applyTextFixes } from "../../core/autofix-engine";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildImplicitSentencePeriodRules } from "./implicit-sentence-period-rules";
import {
  TITLE_CASE_PAIR_CHOICE_RULE_ID,
  buildTitleCasePairChoiceRules,
} from "./title-case-pair-choice-rules";

const rules = buildTitleCasePairChoiceRules();
const allRules = getAutofixRules();

describe("buildTitleCasePairChoiceRules", () => {
  it("предлагает точку или строчную для двух Title Case слов", () => {
    const [fix] = fixesFor("Кватира Обломе", rules);
    expect(fix).toMatchObject({
      applyPolicy: "choice",
      ruleId: TITLE_CASE_PAIR_CHOICE_RULE_ID,
      before: "Кватира Обломе",
      choiceOptions: ["Кватира. Обломе", "Кватира обломе"],
      message: "Проверьте, нужна ли точка",
    });
    expect(fix?.hint).toBeUndefined();
    expect(fix?.hintHtml).toBeUndefined();
  });

  it("предлагает выбор для Пишите Ждите", () => {
    const [fix] = fixesFor("Пишите Ждите", rules);
    expect(fix?.choiceOptions).toEqual(["Пишите. Ждите", "Пишите ждите"]);
  });

  it("не применяется автоматически", () => {
    expect(applyAllRules("Кватира Обломе", allRules)).toBe("Кватира Обломе");
  });

  it("не предлагает строчную для первого слова слоя", () => {
    expect(fixesFor("Ждите нас", rules)).toHaveLength(0);
  });

  it("не срабатывает на брендах из исключений и их словоформах", () => {
    expect(fixesFor("На Циан сегодня", rules)).toHaveLength(0);
    expect(fixesFor("На Циане сегодня", rules)).toHaveLength(0);
    expect(fixesFor("для Циана", rules)).toHaveLength(0);
    expect(fixesFor("с Цианом", rules)).toHaveLength(0);
  });

  it("не срабатывает внутри кавычек", () => {
    expect(fixesFor("партнёр «Яндекс Фокус» подтвердил", rules)).toHaveLength(0);
  });

  it("не ставит неявную точку на Title Case пару", () => {
    const periodFixes = fixesFor("Кватира Обломе", buildImplicitSentencePeriodRules());
    expect(periodFixes).toHaveLength(0);
  });

  it("оставляет confirm-точку после строчных ≥4 букв", () => {
    const input = "по запросу Главное";
    const confirm = fixesFor(input, allRules).filter(
      (fix) => fix.ruleId === "cian-139a-implicit-sentence-period",
    );
    const choice = fixesFor(input, allRules).filter(
      (fix) => fix.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID,
    );
    expect(confirm).toHaveLength(1);
    expect(choice).toHaveLength(0);
  });

  it("предлагает точку или строчную после короткого «в» (в Избранное)", () => {
    const [fix] = fixesFor("объявления в Избранное и решили", rules);
    expect(fix).toMatchObject({
      applyPolicy: "choice",
      ruleId: TITLE_CASE_PAIR_CHOICE_RULE_ID,
      before: "в Избранное",
      choiceOptions: ["в. Избранное", "в избранное"],
    });
  });

  it("ловим в Избранное в полном тексте софт-переноса Figma", () => {
    const input =
      "Считаем, сколько раз пользователи добавили ваши объявления в Избранное и решили купить хату, но ищете:";
    const choice = fixesFor(input, allRules).filter(
      (fix) => fix.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID,
    );
    expect(choice).toHaveLength(1);
    expect(choice[0]?.before).toBe("в Избранное");
    expect(choice[0]?.choiceOptions).toEqual(["в. Избранное", "в избранное"]);
  });

  it("не ставит неявную точку после короткого предлога", () => {
    expect(fixesFor("объявления в Избранное", buildImplicitSentencePeriodRules())).toHaveLength(0);
  });

  it("применяет выбранный вариант точки", () => {
    const [fix] = fixesFor("Кватира Обломе", rules);
    expect(applyTextFixes("Кватира Обломе", [{ ...fix!, after: "Кватира. Обломе" }])).toBe(
      "Кватира. Обломе",
    );
  });

  it("применяет выбранный вариант строчной", () => {
    const [fix] = fixesFor("Кватира Обломе", rules);
    expect(applyTextFixes("Кватира Обломе", [{ ...fix!, after: "Кватира обломе" }])).toBe(
      "Кватира обломе",
    );
  });

  it("применяет строчную для в Избранное", () => {
    const text = "объявления в Избранное";
    const [fix] = fixesFor(text, rules);
    expect(applyTextFixes(text, [{ ...fix!, after: "в избранное" }])).toBe(
      "объявления в избранное",
    );
  });
});
