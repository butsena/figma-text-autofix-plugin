import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

import { checkSpellingFixes } from "./check-spelling";
import { applyHunspellDictionaryFromRaw } from "./hunspell-dictionary-store";
import { ensureSpellCheckerReady } from "./spell-checker";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadTestDictionary(): void {
  const candidates = [
    [path.join(root, "data/hunspell/ru_RU.aff"), path.join(root, "data/hunspell/ru_RU.dic")],
    [
      path.join(root, "node_modules/dictionary-ru/index.aff"),
      path.join(root, "node_modules/dictionary-ru/index.dic"),
    ],
  ];
  for (const [affPath, dicPath] of candidates) {
    if (fs.existsSync(affPath) && fs.existsSync(dicPath)) {
      const ok = applyHunspellDictionaryFromRaw(
        fs.readFileSync(affPath, "utf8"),
        fs.readFileSync(dicPath, "utf8"),
      );
      if (ok) return;
    }
  }
  throw new Error("No Hunspell dictionary for tests (data/hunspell or dictionary-ru)");
}

describe("checkSpellingFixes", () => {
  beforeAll(async () => {
    loadTestDictionary();
    const spell = await ensureSpellCheckerReady();
    expect(spell).not.toBeNull();
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
    expect(fixes[0]?.message).toBe(
      "Возможно, в слове «Кватира» опечатка или ошибка — проверьте",
    );
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

  it("ловит набор в английской раскладке, если после конвертации слово есть в словаре", () => {
    const fixes = checkSpellingFixes("Наберите ghbdtn в чат");
    expect(fixes.some((f) => f.before === "ghbdtn" && f.after === "привет")).toBe(true);
    const layout = fixes.find((f) => f.before === "ghbdtn");
    expect(layout?.ruleId).toBe("orthography-keyboard-layout");
    expect(layout?.message).toContain("английской раскладке");
  });

  it("ловит латинский «мусор» без гласных в русском тексте", () => {
    const fixes = checkSpellingFixes("Пункт 2. kjjklk’;kg в списке");
    const layout = fixes.find((f) => f.before === "kjjklk’;kg");
    expect(layout).toMatchObject({
      after: "лоолдлэжлп",
      ruleId: "orthography-keyboard-layout",
      applyPolicy: "confirm",
    });
  });

  it("не трогает осмысленный английский вроде Figma/online", () => {
    const fixes = checkSpellingFixes("Сверстайте макет в Figma online");
    expect(fixes.filter((f) => f.ruleId === "orthography-keyboard-layout")).toEqual([]);
  });

  it("ловит латиницу, прилипшую к кириллице (gдоказываем)", () => {
    const fixes = checkSpellingFixes("но ищете:\n1. gдоказываем общее к");
    const layout = fixes.find((f) => f.before === "gдоказываем");
    expect(layout).toMatchObject({
      after: "Доказываем",
      ruleId: "orthography-keyboard-layout",
      applyPolicy: "confirm",
    });
  });
});
