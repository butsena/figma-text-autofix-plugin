import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyAllRules } from "../test/helpers";
import { parseReplacementRows, rowsToAutofixRules } from "./replacement-rows";

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../data/text-replacements.csv");

function allRules() {
  return rowsToAutofixRules(parseReplacementRows(readFileSync(csvPath, "utf8")), "curated");
}

describe("курируемый словарь замен", () => {
  const rules = allRules();

  it("сжимается до небольшого числа правил", () => {
    expect(rules.length).toBeLessThanOrEqual(12);
    expect(rules.length).toBeGreaterThanOrEqual(8);
  });

  it("spell/join покрывают словоформы без явного списка", () => {
    expect(applyAllRules("Риэлторам скидка", rules)).toBe("Риелторам скидка");
    expect(applyAllRules("промо-кодов много", rules)).toBe("промокодов много");
    expect(applyAllRules("Кешбека нет", rules)).toBe("Кешбэка нет");
    expect(applyAllRules("он-лайн показ", rules)).toBe("онлайн показ");
    expect(applyAllRules("он-лайн", rules)).toBe("онлайн");
    expect(applyAllRules("Он-лайн", rules)).toBe("Онлайн");
  });

  it("exact и special учитывают регистр", () => {
    expect(applyAllRules("Далее", rules)).toBe("Дальше");
    expect(applyAllRules("цена 100 рублей", rules)).toBe("цена 100 ₽");
  });
});
