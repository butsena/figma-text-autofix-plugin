import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildPunctuationSpacingRules } from "./punctuation-spacing-rules";

const rules = buildPunctuationSpacingRules();

describe("buildPunctuationSpacingRules", () => {
  it("убирает пробел перед запятой", () => {
    expect(applyAllRules("слово , ещё", rules)).toBe("слово, ещё");
  });

  it("схлопывает двойной восклицательный знак", () => {
    expect(applyAllRules("Ура!!", rules)).toBe("Ура!");
  });

  it("схлопывает двойную точку (не троеточие)", () => {
    expect(applyAllRules("Стоп..", rules)).toBe("Стоп.");
  });

  it("схлопывает двойное длинное тире", () => {
    expect(applyAllRules("да——нет", rules)).toBe("да—нет");
  });

  it("схлопывает двойное многоточие", () => {
    expect(applyAllRules("ждём……", rules)).toBe("ждём…");
  });
});
