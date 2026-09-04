import { describe, expect, it } from "vitest";
import { LATIN_CYRILLIC_LETTER, LATIN_CYRILLIC_LETTERS } from "./letters";

describe("letters", () => {
  it("LATIN_CYRILLIC_LETTERS покрывает латиницу и кириллицу с ё", () => {
    expect(LATIN_CYRILLIC_LETTERS).toContain("A-Za-z");
    expect(LATIN_CYRILLIC_LETTERS).toContain("Ёё");
  });

  it("LATIN_CYRILLIC_LETTER матчит буквы и не матчит цифры", () => {
    expect(LATIN_CYRILLIC_LETTER.test("я")).toBe(true);
    expect(LATIN_CYRILLIC_LETTER.test("Z")).toBe(true);
    expect(LATIN_CYRILLIC_LETTER.test("ё")).toBe(true);
    expect(LATIN_CYRILLIC_LETTER.test("7")).toBe(false);
  });
});
