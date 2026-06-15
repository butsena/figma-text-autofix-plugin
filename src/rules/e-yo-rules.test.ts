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

  it("не трогает оплачен (ё не обязательна)", () => {
    expect(fixesFor("оплачен", rules)).toHaveLength(0);
    expect(applyAllRules("оплачен", rules)).toBe("оплачен");
  });
});
