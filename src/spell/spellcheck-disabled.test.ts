import { describe, expect, it } from "vitest";
import { checkSpellingFixes } from "./check-spelling";

describe("checkSpellingFixes with SPELLCHECK_ENABLED=false", () => {
  it("ничего не предлагает, даже если словарь мог бы быть загружен", () => {
    expect(checkSpellingFixes("Кватира в центре")).toEqual([]);
  });
});
