import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildHyphenCompoundRules } from "./hyphen-compound-rules";

const rules = buildHyphenCompoundRules();
const nbsp = "\u00a0";

describe("buildHyphenCompoundRules", () => {
  it("слитное длинное тире → дефис", () => {
    expect(applyAllRules("из—за", rules)).toBe("из-за");
  });

  it("числовой диапазон → короткое тире с NBSP", () => {
    expect(applyAllRules("комнат 2-3", rules)).toBe(`комнат 2${nbsp}–${nbsp}3`);
  });

  it("диапазон с пробелами", () => {
    expect(applyAllRules("от 5 до 10", rules.filter((r) => r.id === "cian-137-numeric-range-endash"))).toBe(
      "от 5 до 10",
    );
    expect(applyAllRules("5 - 10", rules)).toBe(`5${nbsp}–${nbsp}10`);
  });
});
