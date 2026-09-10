import { describe, expect, it } from "vitest";
import { rangesOverlap } from "./ranges-overlap";

describe("rangesOverlap", () => {
  it("находит пересечение полуинтервалов", () => {
    expect(rangesOverlap(0, 3, 2, 5)).toBe(true);
    expect(rangesOverlap(0, 2, 2, 4)).toBe(false);
    expect(rangesOverlap(5, 8, 1, 4)).toBe(false);
    expect(rangesOverlap(1, 4, 2, 3)).toBe(true);
  });
});
