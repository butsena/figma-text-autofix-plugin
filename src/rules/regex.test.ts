import { describe, expect, it } from "vitest";
import {
  cyrillicWholeWordPattern,
  escapeRegex,
  LATIN_CYRILLIC_WORD_EDGE,
} from "./regex";

describe("escapeRegex", () => {
  it("экранирует спецсимволы", () => {
    expect(escapeRegex("a.b(c)*")).toBe("a\\.b\\(c\\)\\*");
  });

  it("не меняет обычный текст", () => {
    expect(escapeRegex("привет")).toBe("привет");
  });
});

describe("cyrillicWholeWordPattern", () => {
  it("находит целое слово с кириллическими границами", () => {
    const re = cyrillicWholeWordPattern("тест|проба");
    expect(re.exec("это тест здесь")?.[2]).toBe("тест");
    expect(re.exec("протест")).toBeNull();
  });

  it("не захватывает префикс перед словом", () => {
    const re = cyrillicWholeWordPattern("sms");
    const match = re.exec(" в sms ");
    expect(match?.[2]).toBe("sms");
    expect(match?.[0]).toBe(" sms");
  });
});

describe("LATIN_CYRILLIC_WORD_EDGE", () => {
  it("экспортирует границу слова для смешанного текста", () => {
    const re = new RegExp(`${LATIN_CYRILLIC_WORD_EDGE}(test)($|[^A-Za-zА-Яа-яЁё])`, "gu");
    expect(re.exec("abc test ")?.[2]).toBe("test");
    re.lastIndex = 0;
    expect(re.exec("contest")).toBeNull();
  });
});
