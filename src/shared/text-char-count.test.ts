import { describe, expect, it } from "vitest";
import { countTextCharacters, formatCharacterCountLabel } from "./text-char-count";

describe("countTextCharacters", () => {
  it("считает символы, включая пробелы и переносы", () => {
    expect(countTextCharacters("")).toBe(0);
    expect(countTextCharacters("abc")).toBe(3);
    expect(countTextCharacters("все\nвсё")).toBe(7);
    expect(countTextCharacters("100 000 ₽")).toBe(9);
  });
});

describe("formatCharacterCountLabel", () => {
  it("склоняет символ / символа / символов", () => {
    expect(formatCharacterCountLabel(1)).toBe("1 символ");
    expect(formatCharacterCountLabel(2)).toBe("2 символа");
    expect(formatCharacterCountLabel(5)).toBe("5 символов");
    expect(formatCharacterCountLabel(11)).toBe("11 символов");
    expect(formatCharacterCountLabel(21)).toBe("21 символ");
    expect(formatCharacterCountLabel(22)).toBe("22 символа");
  });
});
