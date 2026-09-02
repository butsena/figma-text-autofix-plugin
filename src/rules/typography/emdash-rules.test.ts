import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildEmdashRules } from "./emdash-rules";

const rules = buildEmdashRules();
const nbsp = "\u00a0";

describe("buildEmdashRules", () => {
  it("нормализует дефис с пробелами в длинное тире", () => {
    expect(applyAllRules("да - нет", rules)).toBe(`да${nbsp}— нет`);
    expect(applyAllRules("да – нет", rules)).toBe(`да${nbsp}— нет`);
    expect(applyAllRules("да − нет", rules)).toBe(`да${nbsp}— нет`);
  });

  it("не трогает дефис в числовых диапазонах", () => {
    expect(applyAllRules("2020 - 2025", rules)).toBe("2020 - 2025");
  });

  it("ставит неразрывный пробел перед тире после слова", () => {
    expect(applyAllRules("Главное — текст", rules)).toBe(`Главное${nbsp}— текст`);
  });

  it("нормализует пробел после длинного тире перед словом", () => {
    expect(applyAllRules(`да${nbsp}—${nbsp}нет`, rules)).toBe(`да${nbsp}— нет`);
  });

  it("сужает диапазон правки до изменившейся части", () => {
    const fixes = fixesFor("Главное — текст", rules);
    const nbspFix = fixes.find((f) => f.ruleId === "cian-115-nbsp-before-emdash-after-word");
    expect(nbspFix).toMatchObject({
      before: " ",
      after: nbsp,
    });
  });
});
