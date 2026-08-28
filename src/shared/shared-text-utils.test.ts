import { describe, expect, it } from "vitest";
import { capitalizeLike } from "./case";
import { stripUtf8Bom } from "./text-normalize";

describe("capitalizeLike", () => {
  it("сохраняет ALL CAPS", () => {
    expect(capitalizeLike("ИИ", "ии")).toBe("ИИ");
  });

  it("сохраняет заглавную первую букву", () => {
    expect(capitalizeLike("Ищите", "ищете")).toBe("Ищете");
  });
});

describe("stripUtf8Bom", () => {
  it("убирает BOM", () => {
    expect(stripUtf8Bom("\uFEFFтекст")).toBe("текст");
  });
});
