import { describe, expect, it } from "vitest";
import { makeFixId } from "./fix-id";

describe("makeFixId", () => {
  it("собирает стабильный идентификатор из частей", () => {
    expect(makeFixId("node-1", "cian-100", 5, 10)).toBe("node-1:cian-100:5:10");
  });

  it("различает правки с разными диапазонами", () => {
    const a = makeFixId("n", "rule", 0, 3);
    const b = makeFixId("n", "rule", 3, 6);
    expect(a).not.toBe(b);
  });
});
