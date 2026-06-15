import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildNbspBindingRules } from "./nbsp-binding-rules";

const rules = buildNbspBindingRules();
const nbsp = "\u00a0";

describe("buildNbspBindingRules", () => {
  it("число + месяц", () => {
    expect(applyAllRules("12 апреля 2024", rules)).toBe(`12${nbsp}апреля${nbsp}2024`);
  });

  it("год + «г.»", () => {
    expect(applyAllRules("в 2024 г.", rules)).toBe(`в 2024${nbsp}г.`);
  });

  it("сокращение города", () => {
    expect(applyAllRules("г. Москва", rules)).toBe(`г.${nbsp}Москва`);
  });

  it("т. е.", () => {
    expect(applyAllRules("т. е. далее", rules)).toBe(`т.${nbsp}е. далее`);
  });

  it("и т. п.", () => {
    expect(applyAllRules("документы и т. п.", rules)).toBe(`документы и${nbsp}т.${nbsp}п.`);
  });
});
