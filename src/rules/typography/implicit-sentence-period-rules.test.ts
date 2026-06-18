import { describe, expect, it } from "vitest";
import { applyTextFixes } from "../../core/autofix-engine";
import { fixesFor, applyAllRules } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildImplicitSentencePeriodRules } from "./implicit-sentence-period-rules";
import { buildSentenceTerminalPeriodRules } from "./sentence-terminal-period-rules";
import { insertImplicitSentencePeriods, splitIntoSentenceFragmentsWithImplicit } from "./sentence-split";

const rules = buildImplicitSentencePeriodRules();
const allRules = getAutofixRules();

describe("splitIntoSentenceFragmentsWithImplicit", () => {
  it("делит по неявной границе: строчная + пробел + заглавная", () => {
    expect(splitIntoSentenceFragmentsWithImplicit("по запросу Главное — текст")).toEqual([
      "по запросу",
      " Главное — текст",
    ]);
  });
});

describe("insertImplicitSentencePeriods", () => {
  it("ставит точку между предложениями без явной границы", () => {
    const input =
      "Любого слона можно купить онлайн — цену скину вам в смс по запросу Главное — сохраните ваш профиль.";
    expect(insertImplicitSentencePeriods(input)).toBe(
      "Любого слона можно купить онлайн — цену скину вам в смс по запросу. Главное — сохраните ваш профиль.",
    );
  });

  it("не путает короткий предлог и заглавное имя", () => {
    expect(insertImplicitSentencePeriods("квартира в Москве")).toBe("квартира в Москве");
  });
});

describe("buildImplicitSentencePeriodRules", () => {
  it("не применяется автоматически в полном пайплайне", () => {
    const input =
      "Любого слона можно купить онлайн — цену скину вам в смс по запросу Главное — сохраните ваш профиль.";
    const out = applyAllRules(input, allRules);
    expect(out).not.toMatch(/запросу\.\s+Главное/);
  });

  it("находит confirm-правку для слона", () => {
    const input =
      "Любого слона можно купить онлайн — цену скину вам в смс по запросу Главное — сохраните ваш профиль.";
    const fixes = fixesFor(input, rules);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      applyPolicy: "confirm",
      after: ".",
      message: "Редполитика: похоже, между словами пропущена точка.",
    });
  });

  it("после confirm-точек срабатывает авто-правило конца предложения", () => {
    const autoRules = buildSentenceTerminalPeriodRules();
    const input =
      "Любого слона можно купить Онлайн — цену скину вам в смс по запросу Главное — её манера говорить";
    let text = input;
    let confirmFixes = fixesFor(text, rules);
    while (confirmFixes.length > 0) {
      text = applyTextFixes(text, [confirmFixes[0]!]);
      confirmFixes = fixesFor(text, rules);
    }
    text = applyTextFixes(text, fixesFor(text, autoRules));
    expect(text).toMatch(/купить\.\s+Онлайн/);
    expect(text).toMatch(/запросу\.\s+Главное/);
    expect(text).toMatch(/говорить\.$/);
  });
});
