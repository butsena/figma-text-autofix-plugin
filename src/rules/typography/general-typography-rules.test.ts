import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildGeneralTypographyRules } from "./general-typography-rules";

const rules = buildGeneralTypographyRules();
const nbsp = "\u00a0";

describe("buildGeneralTypographyRules", () => {
  it("телефон РФ → стандарт Cian", () => {
    expect(applyAllRules("звоните 89991234567", rules)).toBe(
      `звоните +7${nbsp}999${nbsp}123-45-67`,
    );
  });

  it("число + единица измерения", () => {
    expect(applyAllRules("площадь 45 м²", rules)).toBe(`площадь 45${nbsp}м²`);
  });

  it("процент без пробела", () => {
    expect(
      applyAllRules("скидка 10 %", rules.filter((r) => r.id === "cian-113-percent-without-space")),
    ).toBe("скидка 10%");
  });

  it("три точки → многоточие", () => {
    expect(applyAllRules("ждём...", rules)).toBe("ждём…");
  });

  it("знак № + число", () => {
    expect(applyAllRules("договор № 123", rules)).toBe(`договор №${nbsp}123`);
  });

  it("прямые кавычки → ёлочки", () => {
    expect(applyAllRules('текст "цитата" здесь', rules)).toBe("текст «цитата» здесь");
  });

  it("тире с пробелами → длинное тире", () => {
    expect(applyAllRules("да - нет", rules)).toBe(`да${nbsp}— нет`);
  });

  it("убирает двойные пробелы", () => {
    expect(applyAllRules("слишком  много   пробелов", rules)).toBe("слишком много пробелов");
  });
});
