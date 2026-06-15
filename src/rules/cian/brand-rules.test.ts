import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildCianBrandRules } from "./brand-rules";

const rules = buildCianBrandRules();

describe("buildCianBrandRules", () => {
  it("ЦИАН → Циан", () => {
    expect(applyAllRules("на ЦИАН", rules)).toBe("на Циан");
  });

  it("ЦИАНА → Циана", () => {
    expect(applyAllRules("для ЦИАНА", rules)).toBe("для Циана");
  });

  it("ЦИАНЕ → Циане", () => {
    expect(applyAllRules("в ЦИАНЕ", rules)).toBe("в Циане");
  });

  it("не трогает уже правильное «Циан»", () => {
    expect(fixesFor("на Циан", rules)).toHaveLength(0);
  });
});
