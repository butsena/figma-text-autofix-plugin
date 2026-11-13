import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

import type { TextFix } from "../core/autofix-engine";
import { checkTextWithSpelling, filterRulesByPolicy } from "../figma/scan-text-check";
import { getAutofixRules } from "../rules/autofix-rules";
import { applyAllRules } from "../test/helpers";
import { checkSpellingFixes } from "./check-spelling";
import { applyHunspellDictionaryFromRaw } from "./hunspell-dictionary-store";
import {
  ensureSpellCheckerReady,
  getSpellSuggestMissCount,
  resetSpellSuggestionCache,
} from "./spell-checker";
import { MAX_SPELL_CARDS_PER_TEXT } from "./spell-card-budget";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";
import { MSG_NE_VERB_SEPARATE } from "../rules/rule-messages";
import { NE_VERB_SPLIT_RULE_ID } from "./ne-verb-split";
import { isNbspGlueFix } from "../ui/nbsp-glue-summary";

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

  it("локальная проверка раскладки не передаёт слова или текст слоя в сеть", () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    try {
      const fixes = checkSpellingFixes("Наберите ghbdtn в чат Figma online");
      expect(fixes.some((fix) => fix.before === "ghbdtn" && fix.after === "привет")).toBe(true);
      expect(request).not.toHaveBeenCalled();
    } finally {
      request.mockRestore();
    }
  });

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

  it("ловит слой, в котором только слово в английской раскладке", () => {
    const fixes = checkSpellingFixes("ghbdtn");
    expect(fixes.find((f) => f.before === "ghbdtn")).toMatchObject({
      after: "привет",
      ruleId: "orthography-keyboard-layout",
    });
    expect(
      checkSpellingFixes("Figma online").filter((f) => f.ruleId === "orthography-keyboard-layout"),
    ).toEqual([]);
  });

  it("ловит смешанную абракадабру без готовой подсказки и не режет её на обрывки", () => {
    const fixes = checkSpellingFixes("Пункт kjjклk’;kg в списке");
    expect(fixes.filter((f) => f.ruleId === "orthography-keyboard-layout")).toEqual([
      expect.objectContaining({
        before: "kjjклk’;kg",
        after: "kjjклk’;kg",
        applyPolicy: "confirm",
      }),
    ]);
    expect(fixes.filter((f) => f.ruleId === "orthography-spellcheck")).toEqual([]);
    const glued = checkSpellingFixes("Текст kjjклkkg конец");
    expect(glued.find((f) => f.before === "kjjклkkg")?.after).toBe("kjjклkkg");
    expect(glued.filter((f) => f.ruleId === "orthography-spellcheck")).toEqual([]);
  });

  it("ловит «лctt» в строке онбординга без подстановки «лсее»", () => {
    const fixes = checkSpellingFixes("Ляля-тополя, дикая поляна — это песня лctt меня");
    const layout = fixes.filter((f) => f.ruleId === "orthography-keyboard-layout");
    expect(layout.map((f) => [f.before, f.after])).toEqual([["лctt", "лctt"]]);
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

  it("латинская буква в середине даёт одну карточку раскладки, без орфографических обрывков", () => {
    for (const text of ["Заполните ваш пиyшете тут", "Заполните ваш пишyете тут"]) {
      const fixes = checkSpellingFixes(text);
      expect(fixes.map((f) => [f.ruleId, f.before, f.after])).toEqual([
        ["orthography-keyboard-layout", text.includes("пиyшете") ? "пиyшете" : "пишyете", "пишете"],
      ]);
    }
  });

  it("латинская y у пишите/пишете остаётся карточкой, даже если choice уже закрыл основу", () => {
    const text = "Заполните ваш yпишете или yпишите, псина!";
    const yPishete = text.indexOf("yпишете");
    const stemFrom = yPishete + 1;
    const choiceOnStem: TextFix = {
      from: stemFrom,
      to: stemFrom + "пишете".length,
      before: "пишете",
      after: "пишете",
      ruleId: "choice-ambiguous-form",
      category: "form_choice",
      message: "choice",
      priority: 78,
      applyPolicy: "choice",
    };
    const fixes = checkSpellingFixes(text, [choiceOnStem]);
    const layout = fixes.filter((f) => f.ruleId === "orthography-keyboard-layout");
    expect(layout.map((f) => ({ before: f.before, after: f.after }))).toEqual([
      { before: "yпишете", after: "пишете" },
      { before: "yпишите", after: "пишите" },
    ]);
    expect(layout.every((f) => f.after !== f.before.replace(/y/g, "н"))).toBe(true);
  });

  it("вместе с choice формы и без ложной раскладки на обычных пишите/пишете", () => {
    const text = "Заполните ваш yпишете или yпишите, псина!";
    const fixes = checkTextWithSpelling(text, filterRulesByPolicy("all"));
    const layout = fixes.filter((f) => f.ruleId === "orthography-keyboard-layout");
    expect(layout.map((f) => [f.before, f.after])).toEqual([
      ["yпишете", "пишете"],
      ["yпишите", "пишите"],
    ]);
    expect(
      fixes.filter((f) => f.applyPolicy === "choice").map((f) => f.before),
    ).toEqual(["пишете", "пишите"]);

    for (const plain of ["пишите письма", "пишете письма"]) {
      const plainFixes = checkTextWithSpelling(plain, filterRulesByPolicy("all"));
      expect(plainFixes.filter((f) => f.ruleId === "orthography-keyboard-layout")).toEqual([]);
      expect(plainFixes.some((f) => f.applyPolicy === "choice")).toBe(true);
    }
  });

  it("«,elbnt» и «,elbntg» не склеиваются с «Не» и не становятся «Будите»", () => {
    const rules = getAutofixRules();
    for (const latin of [",elbnt", ",elbntg"]) {
      const source = `Не ${latin} медведя!`;
      const afterAuto = applyAllRules(source, rules);
      expect(afterAuto).toMatch(new RegExp(`^Не[\\u00a0 ]${latin.replace(",", "\\,")} медведя!$`));

      const layout = checkSpellingFixes(afterAuto).find((f) => f.before === latin);
      expect(layout).toMatchObject({
        ruleId: "orthography-keyboard-layout",
        after: "будите",
      });

      const applied =
        afterAuto.slice(0, layout!.from) + layout!.after + afterAuto.slice(layout!.to);
      expect(applied).toMatch(/^Не[\u00a0 ]будите медведя!$/);
      expect(
        checkSpellingFixes(applied).filter((f) => /небудите/i.test(f.before)),
      ).toEqual([]);
    }

    const glued = checkSpellingFixes("Не,elbnt медведя!").find((f) => f.before === ",elbnt");
    expect(glued?.after).toBe(" будите");
    expect(`Не${glued!.after} медведя!`).toBe("Не будите медведя!");
  });

  it("одинаковая опечатка не вызывает suggest второй раз", () => {
    resetSpellSuggestionCache();
    const first = checkSpellingFixes("Кватира");
    expect(first[0]?.after).toBe("Квартира");
    const misses = getSpellSuggestMissCount();
    expect(misses).toBe(1);
    const second = checkSpellingFixes("Ещё Кватира тут");
    expect(second.find((f) => f.before === "Кватира")?.after).toBe("Квартира");
    expect(getSpellSuggestMissCount()).toBe(misses);
  });

  it("раскладка не идёт через suggest словаря", () => {
    resetSpellSuggestionCache();
    const fixes = checkSpellingFixes("Наберите ghbdtn в чат");
    expect(fixes.find((f) => f.before === "ghbdtn")?.after).toBe("привет");
    expect(getSpellSuggestMissCount()).toBe(0);
    const mixed = checkSpellingFixes("Заполните ваш yпишете или yпишите, псина!");
    expect(mixed.filter((f) => f.ruleId === "orthography-keyboard-layout").map((f) => f.after)).toEqual([
      "пишете",
      "пишите",
    ]);
    expect(getSpellSuggestMissCount()).toBe(0);
  });

  it("whitelist «смс» не становится опечаткой", () => {
    const fixes = checkSpellingFixes("Отправьте смс клиенту");
    expect(fixes.filter((f) => f.ruleId === ORTHOGRAPHY_SPELL_RULE_ID).map((f) => f.before)).not.toContain(
      "смс",
    );
  });

  it("слитое «не»+глагол — confirm редполитики, не карточка опечатки", () => {
    const fixes = checkSpellingFixes("Пока неотключите уведомления");
    const split = fixes.find((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID);
    expect(split).toMatchObject({
      before: "неотключите",
      after: "не отключите",
      applyPolicy: "confirm",
      category: "cian_editorial",
      message: MSG_NE_VERB_SEPARATE,
    });
    expect(isNbspGlueFix({ before: split!.before, after: split!.after })).toBe(false);
    expect(fixes.filter((f) => f.ruleId === ORTHOGRAPHY_SPELL_RULE_ID).map((f) => f.before)).not.toContain(
      "неотключите",
    );

    expect(checkSpellingFixes("не отключите уведомления").some((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)).toBe(
      false,
    );
    for (const word of ["ненавидеть", "нельзя", "неплохо", "невысокий", "неработающий"]) {
      expect(checkSpellingFixes(word).some((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)).toBe(false);
    }
  });

  it("ne-verb: регистр, «йтесь», ложные существительные и уже занятый диапазон", () => {
    expect(checkSpellingFixes("НЕОТКЛЮЧИТЕ").find((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)?.after).toBe(
      "НЕ ОТКЛЮЧИТЕ",
    );
    expect(checkSpellingFixes("небойтесь").find((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)?.after).toBe(
      "не бойтесь",
    );
    expect(checkSpellingFixes("несмейтесь").find((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)?.after).toBe(
      "не смейтесь",
    );

    for (const word of ["немаршрут", "неканал", "непривет", "несу", "неси"]) {
      expect(checkSpellingFixes(word).some((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)).toBe(false);
    }

    const occupied = checkSpellingFixes("неотключите", [
      { from: 0, to: 11, before: "неотключите", after: "x", ruleId: "other", category: "typography", message: "x", priority: 1, applyPolicy: "auto" },
    ]);
    expect(occupied.some((f) => f.ruleId === NE_VERB_SPLIT_RULE_ID)).toBe(false);
  });

  it("не предлагает раскладку рядом с @ / :// / www.", () => {
    expect(
      checkSpellingFixes("Пишите на user@ghbdtn.com").filter((f) => f.ruleId === "orthography-keyboard-layout"),
    ).toEqual([]);
    expect(
      checkSpellingFixes("Откройте https://ghbdtn.ru").filter((f) => f.ruleId === "orthography-keyboard-layout"),
    ).toEqual([]);
    expect(
      checkSpellingFixes("Зеркало www.ghbdtn.ru").filter((f) => f.ruleId === "orthography-keyboard-layout"),
    ).toEqual([]);
  });

  it("«,elbnt» после буквы получает ведущий пробел в подстановке", () => {
    const fixes = checkSpellingFixes("слово,elbnt дальше");
    const layout = fixes.find((f) => f.before === ",elbnt");
    expect(layout?.after).toBe(" будите");
    expect(layout?.ruleId).toBe("orthography-keyboard-layout");
  });

  it("стена мусора не считает suggest на каждое слово", () => {
    resetSpellSuggestionCache();
    const letters = "абвгдежзиклмнопрстуфхцчшщыэюя";
    const words = Array.from({ length: 20 }, (_, i) => `ъъъ${letters[i] ?? "а"}ффжж`);
    const text = words.join(" ");
    const cards = checkSpellingFixes(text).filter((f) => f.ruleId === ORTHOGRAPHY_SPELL_RULE_ID);
    expect(cards.length).toBeLessThanOrEqual(MAX_SPELL_CARDS_PER_TEXT);
    expect(cards.length).toBeGreaterThan(0);
    expect(getSpellSuggestMissCount()).toBe(cards.length);
    expect(getSpellSuggestMissCount()).toBeLessThanOrEqual(MAX_SPELL_CARDS_PER_TEXT);

    const merged = checkTextWithSpelling(text, filterRulesByPolicy("all"));
    expect(merged.some((f) => f.ruleId === "cian-138-sentence-start-capitalize")).toBe(false);
    expect(merged.filter((f) => f.ruleId === ORTHOGRAPHY_SPELL_RULE_ID).length).toBeLessThanOrEqual(
      MAX_SPELL_CARDS_PER_TEXT,
    );
  }, 60_000);

});
