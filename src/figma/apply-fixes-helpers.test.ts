import { describe, expect, it } from "vitest";
import { isCaseOnlyChange } from "./apply-fixes-helpers";

describe("isCaseOnlyChange", () => {
  it("true только при смене регистра той же строки", () => {
    expect(isCaseOnlyChange("с", "С")).toBe(true);
    expect(isCaseOnlyChange("Вас", "вас")).toBe(true);
    expect(isCaseOnlyChange("вас", "вас")).toBe(false);
    expect(isCaseOnlyChange("вас", "вам")).toBe(false);
    expect(isCaseOnlyChange("ва", "вас")).toBe(false);
    expect(isCaseOnlyChange("", "А")).toBe(false);
  });
});
