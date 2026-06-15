import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildCianBrandRules } from "./brand-rules";
import {
  buildCianNounOrNetDeclensionRule,
  buildCianPrepositionDeclensionRules,
} from "./prep-declension-table";

const prepRules = buildCianPrepositionDeclensionRules();
const nounRule = buildCianNounOrNetDeclensionRule();
const brandRules = buildCianBrandRules();

describe("buildCianPrepositionDeclensionRules", () => {
  it("в Циан → в Циане (предложный)", () => {
    expect(applyAllRules("квартира в Циан", prepRules)).toBe("квартира в Циане");
  });

  it("для Циан → для Циана (родительный)", () => {
    expect(applyAllRules("акция для Циан", prepRules)).toBe("акция для Циана");
  });

  it("про Циан → про Циан (винительный)", () => {
    expect(applyAllRules("статья про Циан", prepRules)).toBe("статья про Циан");
  });

  it("о Циан → о Циане (предлог «о» не путается с «про»)", () => {
    expect(applyAllRules("статья о Циан", prepRules)).toBe("статья о Циане");
  });

  it("подать через Циан (винительный)", () => {
    expect(applyAllRules("подать через Циан", prepRules)).toBe("подать через Циан");
  });

  it("к Циан → к Циану (дательный)", () => {
    expect(applyAllRules("обращайтесь к Циан", prepRules)).toBe("обращайтесь к Циану");
  });

  it("не склоняет ЦИАН в верхнем регистре (нужно правило бренда)", () => {
    expect(applyAllRules("квартира в ЦИАН", prepRules)).toBe("квартира в ЦИАН");
  });

  it("после нормализации бренда склоняет в Циане", () => {
    const branded = applyAllRules("квартира в ЦИАН", brandRules);
    expect(applyAllRules(branded, prepRules)).toBe("квартира в Циане");
  });
});

describe("buildCianNounOrNetDeclensionRule", () => {
  it("нет Циан → нет Циана", () => {
    expect(applyAllRules("нет Циан", [nounRule])).toBe("нет Циана");
  });

  it("сайт Циан → сайт Циана", () => {
    expect(applyAllRules("официальный сайт Циан", [nounRule])).toBe("официальный сайт Циана");
  });
});
