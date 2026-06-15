import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildNumberGroupingRules, formatThousands } from "./number-grouping";

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

  it("не трогает 11-значный номер телефона", () => {
    expect(fixesFor("89991234567", rules)).toHaveLength(0);
  });
});
