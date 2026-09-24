/**
 * Одноразовый прогон кейсов из manual-qa-checklist (без Figma UI).
 * Запуск: npx vitest run src/test/manual-qa-checklist-verify.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { checkTextForAutofixes } from "../core/autofix-engine";
import { getAutofixRules } from "../rules/autofix-rules";
import { applyAllRules, fixesFor } from "./helpers";
import { TITLE_CASE_PAIR_CHOICE_RULE_ID } from "../rules/typography/title-case-pair-choice-rules";
import { checkSpellingFixes } from "../spell/check-spelling";
import { applyHunspellDictionaryFromRaw } from "../spell/hunspell-dictionary-store";
import { ensureSpellCheckerReady } from "../spell/spell-checker";
import { applySpellWhitelistFromRaw } from "../spell/spell-word-list-store";
import { vi } from "vitest";

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nbsp = "\u00a0";
const allRules = () => getAutofixRules();

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
      applyHunspellDictionaryFromRaw(
        fs.readFileSync(affPath, "utf8"),
        fs.readFileSync(dicPath, "utf8"),
      );
      return;
    }
  }
  throw new Error("No Hunspell dictionary");
}

describe("manual QA checklist verify", () => {
  beforeAll(async () => {
    loadTestDictionary();
    applySpellWhitelistFromRaw(
      fs.readFileSync(path.join(root, "data/hunspell/spell-whitelist.txt"), "utf8"),
    );
    await ensureSpellCheckerReady();
  }, 30_000);

  it("#1 choice напишите", () => {
    const choice = fixesFor("напишите мне", allRules()).filter((f) => f.applyPolicy === "choice");
    expect(choice.length).toBeGreaterThan(0);
  });

  it("#3 title-case Кватира Обломе", () => {
    const [fix] = fixesFor("Кватира Обломе", allRules()).filter(
      (f) => f.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID,
    );
    expect(fix?.choiceOptions).toEqual(["Кватира. Обломе", "Кватира обломе"]);
    expect(applyAllRules("Кватира Обломе", allRules())).toBe("Кватира Обломе");
  });

  it("#4 title-case exceptions", () => {
    expect(fixesFor("Ждите нас", allRules()).filter((f) => f.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID)).toHaveLength(0);
    expect(fixesFor("На Циан сегодня", allRules()).filter((f) => f.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID)).toHaveLength(0);
    expect(
      fixesFor("партнёр «Яндекс Фокус» подтвердил", allRules()).filter(
        (f) => f.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID,
      ),
    ).toHaveLength(0);
  });

  it("#5 в Избранное", () => {
    const choice = fixesFor(
      "Считаем, сколько раз пользователи добавили ваши объявления в Избранное и решили купить хату, но ищете:",
      allRules(),
    ).filter((f) => f.ruleId === TITLE_CASE_PAIR_CHOICE_RULE_ID);
    expect(choice[0]?.choiceOptions).toEqual(["в. Избранное", "в избранное"]);
    const confirm = fixesFor("по запросу Главное", allRules()).filter(
      (f) => f.ruleId === "cian-139a-implicit-sentence-period",
    );
    expect(confirm).toHaveLength(1);
  });

  it("#6 numbered list capitalize", () => {
    const text =
      "1. показываем общее количество за каждый день в выбранный период\n2. пав картер мс";
    const caps = fixesFor(text, allRules()).filter((f) =>
      f.ruleId === "cian-138-numbered-list-capitalize",
    );
    expect(caps).toHaveLength(2);
    expect(caps.every((f) => f.applyPolicy === "confirm")).toBe(true);
    expect(applyAllRules(text, allRules())).toMatch(/^1\. показываем[\s\S]*\n2\. пав/);
  });

  it("#7–10 spelling / layout", () => {
    expect(checkSpellingFixes("Кватира в центре").some((f) => f.before === "Кватира")).toBe(true);
    expect(checkSpellingFixes("Наберите ghbdtn в чат").some((f) => f.after === "привет")).toBe(true);
    expect(
      checkSpellingFixes("но ищете:\n1. gдоказываем общее к").some(
        (f) => f.before === "gдоказываем" && f.after === "Доказываем",
      ),
    ).toBe(true);
    expect(
      checkSpellingFixes("Сверстайте макет в Figma online").filter(
        (f) => f.ruleId === "orthography-keyboard-layout",
      ),
    ).toEqual([]);
  });

  it("#12 смс whitelist + SMS", () => {
    expect(checkSpellingFixes("код в смс придёт")).toEqual([]);
    expect(applyAllRules("получите SMS сегодня", allRules())).toMatch(/смс/i);
  });

  it("#19 Заполни → Заполните", () => {
    expect(applyAllRules("заполни твой профиль", allRules())).toBe("заполните ваш профиль");
  });

  it("#20 double NBSP", () => {
    expect(applyAllRules(`слово${nbsp}${nbsp}слово`, allRules())).toBe(`слово${nbsp}слово`);
  });

  it("#18 auto typography sample", () => {
    const { fixes } = checkTextForAutofixes("да - нет", allRules());
    expect(fixes.some((f) => f.applyPolicy === "auto")).toBe(true);
  });
});
