import { describe, expect, it } from "vitest";
import { caseStylesAreUniform, mapStylesForReplacement, type CharTextStyle } from "./text-style-snapshot";

const style = (id: string): CharTextStyle => ({
  fontName: { family: "Inter", style: id },
  fontSize: 14,
  fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
  fillsKnown: true,
  letterSpacing: { unit: "PERCENT", value: 0 },
  lineHeight: { unit: "AUTO" },
  textCase: "ORIGINAL",
  textDecoration: "NONE",
  textStyleId: "",
  fillStyleId: "",
  localFontOverride: false,
});

describe("mapStylesForReplacement", () => {
  it("сохраняет длину при равной замене", () => {
    expect(mapStylesForReplacement([style("Bold"), style("Bold"), style("Bold")], 3)).toHaveLength(3);
  });

  it("расширяет стиль последнего символа: и → ите", () => {
    const mapped = mapStylesForReplacement([style("Bold")], 3);
    expect(mapped).toHaveLength(3);
    expect(mapped.every((s) => s.fontName.style === "Bold")).toBe(true);
  });

  it("сжимает при укорочении", () => {
    const mapped = mapStylesForReplacement([style("A"), style("B"), style("C")], 2);
    expect(mapped.map((s) => s.fontName.style)).toEqual(["A", "B"]);
  });

  it("сохраняет стиль при смене регистра одного символа", () => {
    const mapped = mapStylesForReplacement([style("Bold")], 1);
    expect(mapped).toEqual([style("Bold")]);
  });
});

describe("caseStylesAreUniform", () => {
  it("одинаковый регистровый диапазон можно записать одним setRange", () => {
    expect(caseStylesAreUniform([style("Regular"), style("Regular")])).toBe(true);
  });

  it("разный интервал не схлопывается", () => {
    const wide = style("Regular");
    wide.letterSpacing = { unit: "PERCENT", value: 8 };
    expect(caseStylesAreUniform([style("Regular"), wide])).toBe(false);
  });
});
