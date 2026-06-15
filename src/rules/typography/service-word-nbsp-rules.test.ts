import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildServiceWordNbspRules } from "./service-word-nbsp-rules";

const rules = buildServiceWordNbspRules();
const nbsp = "\u00a0";

describe("buildServiceWordNbspRules", () => {
  it("неразрывный пробел после «и»", () => {
    expect(applyAllRules("квартира и дом", rules)).toBe(`квартира и${nbsp}дом`);
  });

  it("неразрывный пробел после «в»", () => {
    expect(applyAllRules("оплата в банке", rules)).toBe(`оплата в${nbsp}банке`);
  });

  it("не трогает «и» без пробела после", () => {
    expect(fixesFor("иван", rules)).toHaveLength(0);
  });
});
