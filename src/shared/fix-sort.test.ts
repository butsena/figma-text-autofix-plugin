import { describe, expect, it } from "vitest";
import {
  compareFixesByPosition,
  compareFixesForApply,
  orderFixesForApply,
} from "./fix-sort";

describe("compareFixesByPosition", () => {
  it("сортирует слева направо, затем по priority", () => {
    const items = [
      { from: 5, to: 6, priority: 1, id: "later" },
      { from: 0, to: 2, priority: 10, id: "low" },
      { from: 0, to: 2, priority: 72, id: "high" },
    ];
    expect([...items].sort(compareFixesByPosition).map((x) => x.id)).toEqual([
      "high",
      "low",
      "later",
    ]);
  });
});

describe("orderFixesForApply", () => {
  it("сортирует справа налево", () => {
    const ordered = orderFixesForApply([
      { from: 0, to: 1, priority: 1 },
      { from: 5, to: 6, priority: 1 },
      { from: 2, to: 4, priority: 9 },
    ]);
    expect(ordered.map((f) => f.from)).toEqual([5, 2, 0]);
  });

  it("compareFixesForApply совпадает с orderFixesForApply", () => {
    const a = { from: 3, to: 4, priority: 1 };
    const b = { from: 1, to: 2, priority: 1 };
    expect(compareFixesForApply(a, b)).toBeLessThan(0);
  });
});
