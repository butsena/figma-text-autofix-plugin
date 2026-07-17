import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildHyphenCompoundRules } from "./hyphen-compound-rules";

const rules = buildHyphenCompoundRules();

describe("buildHyphenCompoundRules", () => {
  it("слитное длинное тире → ASCII-дефис", () => {
    const out = applyAllRules("из—за", rules);
    expect(out).toBe("из-за");
    expect(out.charAt(2)).toBe("\u002D");
  });

  it("типографский дефис U+2010 → ASCII-дефис", () => {
    const out = applyAllRules("из\u2010за", rules);
    expect(out).toBe("из-за");
    expect(out.charAt(2)).toBe("\u002D");
  });

  it("числовой диапазон → короткое тире без пробелов", () => {
    expect(applyAllRules("комнат 2-3", rules)).toBe("комнат 2–3");
  });

  it("диапазон с пробелами вокруг разделителя", () => {
    expect(applyAllRules("от 5 до 10", rules.filter((r) => r.id === "cian-137-numeric-range-endash"))).toBe(
      "от 5 до 10",
    );
    expect(applyAllRules("5 - 10", rules)).toBe("5–10");
  });
});
