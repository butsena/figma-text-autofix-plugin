import { describe, expect, it } from "vitest";
import { capitalizeLike, foldYoToYe, replacementFromSpellInput } from "./case";
import { stripUtf8Bom } from "./text-normalize";

describe("capitalizeLike", () => {
  it("сохраняет ALL CAPS", () => {
    expect(capitalizeLike("ИИ", "ии")).toBe("ИИ");
  });

  it("сохраняет заглавную первую букву", () => {
    expect(capitalizeLike("Ищите", "ищете")).toBe("Ищете");
  });

  it("не считает запятую раскладки заглавной буквой", () => {
    expect(capitalizeLike(",elbnt", "будите")).toBe("будите");
    expect(capitalizeLike("Ghbdtn", "привет")).toBe("Привет");
    expect(capitalizeLike(",ELBNT", "будите")).toBe("БУДИТЕ");
  });

  it("сохраняет ведущий пробел подсказки раскладки", () => {
    expect(replacementFromSpellInput(",elbnt", " будите", " будите")).toBe(" будите");
    expect(replacementFromSpellInput(",elbnt", "будите", "будите")).toBe("будите");
  });
});

describe("foldYoToYe", () => {
  it("меняет только ё и Ё", () => {
    expect(foldYoToYe("ещё")).toBe("еще");
    expect(foldYoToYe("Ёлка")).toBe("Елка");
    expect(foldYoToYe("отчёт и счёт")).toBe("отчет и счет");
    expect(foldYoToYe("дом")).toBe("дом");
  });
});

describe("stripUtf8Bom", () => {
  it("убирает BOM", () => {
    expect(stripUtf8Bom("\uFEFFтекст")).toBe("текст");
  });
});
