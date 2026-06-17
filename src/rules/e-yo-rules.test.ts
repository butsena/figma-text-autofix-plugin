import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../test/helpers";
import { buildEYoRules } from "./e-yo-rules";

const rules = buildEYoRules();

describe("buildEYoRules", () => {
  it("исправляет подтвержден → подтверждён", () => {
    expect(applyAllRules("подтвержден", rules)).toBe("подтверждён");
  });

  it("исправляет подтвержден после другого слова с «е»", () => {
    expect(applyAllRules("не подтвержден", rules)).toBe("не подтверждён");
  });

  it("сохраняет регистр: Подтвержден → Подтверждён", () => {
    expect(applyAllRules("Подтвержден", rules)).toBe("Подтверждён");
  });

  it("исправляет платеж → платёж", () => {
    expect(applyAllRules("платеж", rules)).toBe("платёж");
  });

  it("исправляет еще → ещё", () => {
    expect(applyAllRules("еще", rules)).toBe("ещё");
  });

  it("исправляет мое → моё", () => {
    expect(applyAllRules("мое", rules)).toBe("моё");
    expect(applyAllRules("Мое", rules)).toBe("Моё");
  });

  it("исправляет свое → своё", () => {
    expect(applyAllRules("свое", rules)).toBe("своё");
  });

  it("исправляет твое → твоё", () => {
    expect(applyAllRules("твое", rules)).toBe("твоё");
  });

  it("исправляет ее → её", () => {
    expect(applyAllRules("ее", rules)).toBe("её");
    expect(applyAllRules("по ее адресу", rules)).toBe("по её адресу");
  });

  it("исправляет нее → неё", () => {
    expect(applyAllRules("нее", rules)).toBe("неё");
  });

  it("исправляет пришлем → пришлём", () => {
    expect(applyAllRules("Мы пришлем документы", rules)).toBe("Мы пришлём документы");
    expect(applyAllRules("Пришлем", rules)).toBe("Пришлём");
  });

  it("не трогает все (омоним, только confirm)", () => {
    expect(fixesFor("все", rules)).toHaveLength(0);
    expect(applyAllRules("все варианты", rules)).toBe("все варианты");
  });

  it("не трогает оплачен (ё не обязательна)", () => {
    expect(fixesFor("оплачен", rules)).toHaveLength(0);
    expect(applyAllRules("оплачен", rules)).toBe("оплачен");
  });
});
