import { beforeAll, describe, expect, it } from "vitest";
import { checkSpellingFixes } from "./check-spelling";
import { ensureSpellCheckerReady } from "./spell-checker";

describe("checkSpellingFixes", () => {
  beforeAll(async () => {
    await ensureSpellCheckerReady();
  }, 30_000);

  it("находит опечатку с предложением исправления", () => {
    const fixes = checkSpellingFixes("Кватира в центре");
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      before: "Кватира",
      after: "Квартира",
      applyPolicy: "confirm",
      ruleId: "orthography-spellcheck",
    });
  });

  it("не помечает корректные формы", () => {
    expect(checkSpellingFixes("Квартира в новостройке")).toEqual([]);
    expect(checkSpellingFixes("квартире у метро")).toEqual([]);
  });

  it("не дублирует диапазон, если правило уже покрывает слово", () => {
    const existing = [
      {
        from: 0,
        to: 7,
        before: "Кватира",
        after: "Квартира",
        ruleId: "other",
        category: "test",
        message: "test",
        priority: 99,
        applyPolicy: "confirm" as const,
      },
    ];
    expect(checkSpellingFixes("Кватира в центре", existing)).toEqual([]);
  });
});
