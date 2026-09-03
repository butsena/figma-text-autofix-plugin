import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildQuotesRules } from "./quotes-rules";

const rules = buildQuotesRules();

describe("buildQuotesRules", () => {
  it("заменяет ASCII-кавычки на ёлочки", () => {
    expect(applyAllRules('текст "цитата" здесь', rules)).toBe("текст «цитата» здесь");
  });

  it("заменяет типографские Unicode-кавычки на ёлочки", () => {
    expect(applyAllRules("текст \u201Cцитата\u201D здесь", rules)).toBe("текст «цитата» здесь");
  });

  it("обрабатывает несколько пар кавычек", () => {
    expect(applyAllRules('"один" и "два"', rules)).toBe("«один» и «два»");
  });

  it("не трогает уже правильные ёлочки", () => {
    expect(applyAllRules("текст «цитата» здесь", rules)).toBe("текст «цитата» здесь");
  });

  it("создаёт отдельные правки для ASCII и curly-кавычек", () => {
    const asciiFixes = fixesFor('"test"', rules);
    const curlyFixes = fixesFor("\u201Ctest\u201D", rules);
    expect(asciiFixes.some((f) => f.ruleId === "cian-119-quotes-ascii-to-guillemets")).toBe(true);
    expect(curlyFixes.some((f) => f.ruleId === "cian-120-quotes-curly-unicode-to-guillemets")).toBe(
      true,
    );
  });
});
