import { describe, expect, it } from "vitest";
import { getAutofixRules } from "../autofix-rules";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildNumberGroupingRules, fixMalformedGroupedNumber, formatThousands } from "./number-grouping";

const rules = buildNumberGroupingRules();
const nbsp = "\u00a0";

describe("formatThousands", () => {
  it("группирует по три цифры", () => {
    expect(formatThousands("100000")).toBe(`100${nbsp}000`);
    expect(formatThousands("1000000")).toBe(`1${nbsp}000${nbsp}000`);
  });
});

describe("buildNumberGroupingRules", () => {
  it("разбивает длинное число", () => {
    expect(applyAllRules("цена 1000000 руб.", rules)).toBe(`цена 1${nbsp}000${nbsp}000 руб.`);
  });

  it("заменяет обычные пробелы на NBSP в уже сгруппированном числе", () => {
    expect(applyAllRules("от 100 000 ₽", rules)).toBe(`от 100${nbsp}000 ₽`);
  });

  it("заменяет обычный пробел в числе со смешанными разделителями", () => {
    expect(applyAllRules(`1${nbsp}000 000 млн`, rules)).toBe(`1${nbsp}000${nbsp}000 млн`);
    expect(applyAllRules(`1${nbsp}000 000${nbsp}млн`, rules)).toBe(`1${nbsp}000${nbsp}000${nbsp}млн`);
  });

  it("полный пайплайн: 1 000 000 млн со смешанными пробелами", () => {
    const allRules = getAutofixRules();
    const input = `1${nbsp}000 000${nbsp}млн`;
    expect(applyAllRules(input, allRules)).toBe(`1${nbsp}000${nbsp}000${nbsp}млн`);
    expect(fixesFor(input, allRules).some((f) => f.ruleId === "cian-135-nbsp-within-grouped-numbers")).toBe(
      true,
    );
  });

  it("исправляет неверную разбивку: 100 0 000", () => {
    expect(applyAllRules("цена 100 0 000 ₽", rules)).toBe(`цена 1${nbsp}000${nbsp}000 ₽`);
    expect(applyAllRules(`от 100 0${nbsp}000`, rules)).toBe(`от 1${nbsp}000${nbsp}000`);
  });

  it("не трогает корректную разбивку при проверке malformed", () => {
    expect(fixMalformedGroupedNumber("100 000")).toBeNull();
    expect(fixMalformedGroupedNumber("1 000 000")).toBeNull();
  });

  it("не трогает 11-значный номер телефона", () => {
    expect(fixesFor("89991234567", rules)).toHaveLength(0);
  });
});
