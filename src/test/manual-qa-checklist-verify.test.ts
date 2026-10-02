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
import { renderReportHtml } from "../ui/ui-render-sections";
import { state } from "../ui/ui-state";
import { checkSpellingFixes } from "../spell/check-spelling";
import { applyHunspellDictionaryFromRaw } from "../spell/hunspell-dictionary-store";
import {
  ensureSpellCheckerReady,
  getSpellSuggestMissCount,
  resetSpellSuggestionCache,
} from "../spell/spell-checker";
import { MAX_SPELL_CARDS_PER_TEXT } from "../spell/spell-card-budget";
import {
  createMemorySpellDictionaryCache,
  spellDictionaryCacheSkipsNetwork,
} from "../spell/spell-dictionary-cache";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";
import {
  readResponseEtag,
  refreshSpellDictionaryFromRemote,
} from "../lexicon/refresh-spell-from-remote";
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
    expect(fix?.message).toBe("Проверьте, нужна ли точка");
    expect(fix?.hint).toBeUndefined();
    expect(fix?.hintHtml).toBeUndefined();
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

  it("#35 авто-отчёт схлопывает NBSP", () => {
    state.spellcheckInProgress = false;
    state.summary = { checkedLayers: 1, foundFixes: 2, confirmFixes: 0, choiceFixes: 0 };
    state.lastManualReport = null;
    const glue = "\u00a0";
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 2, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 10,
          fixes: [
            {
              fixId: "b1",
              ruleId: "cian-001-cian-brand-uppercase",
              category: "cian_branding",
              message: "Бренд: «ЦИАН» → «Циан»",
              before: "ЦИАН",
              after: "Циан",
              from: 0,
              to: 4,
              sourceText: "ЦИАН и дом",
            },
            {
              fixId: "n1",
              ruleId: "cian-095-nbsp-и",
              category: "typography",
              message: "Типографика: неразрывный пробел после служебного слова",
              before: " ",
              after: glue,
              from: 6,
              to: 7,
              sourceText: "ЦИАН и дом",
            },
          ],
        },
      ],
    };
    const html = renderReportHtml();
    expect(html).toContain("Типографика: неразрывные пробелы");
    expect(html).toContain("1 склейка в этом слое");
    expect(html).toContain("Бренд: «ЦИАН» → «Циан»");
    expect(html).not.toContain("Типографика: неразрывный пробел после служебного слова");
    state.lastReport = null;
    state.summary = null;
  });

  it("#31 авто-отчёт «Исправлено автоматически»", () => {
    state.spellcheckInProgress = false;
    state.summary = { checkedLayers: 1, foundFixes: 1, confirmFixes: 0, choiceFixes: 0 };
    state.lastManualReport = null;
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 4,
          fixes: [
            {
              fixId: "a1",
              ruleId: "cian-brand",
              category: "brand",
              message: "Циан",
              before: "ЦИАН",
              after: "Циан",
              from: 0,
              to: 4,
              sourceText: "ЦИАН",
            },
          ],
        },
      ],
    };
    const html = renderReportHtml();
    expect(html).toContain("Исправлено автоматически");
    expect(html).not.toContain("Что исправлено автоматически");
    state.lastReport = null;
    state.summary = null;
  });


  it("#36 choice будите / будете", () => {
    const pairId = "cian-choice-budite-budete";
    const wake = fixesFor("не будите спящего", allRules());
    const wakeChoice = wake.filter((f) => f.ruleId === pairId);
    expect(wakeChoice).toMatchObject([
      {
        applyPolicy: "choice",
        before: "будите",
        choiceOptions: ["будите", "будете"],
      },
    ]);
    expect(wakeChoice[0]?.hintHtml).toContain("что делайте?");
    expect(wakeChoice[0]?.hintHtml).toContain("не будите спящего");
    expect(wakeChoice[0]?.hintHtml).toContain("форма «быть»");
    expect(wakeChoice[0]?.hintHtml).toContain("вы будете дома вечером");
    expect(wake.filter((f) => f.applyPolicy === "confirm")).toMatchObject([
      { ruleId: "cian-138-sentence-start-capitalize", before: "н", after: "Н" },
    ]);
    expect(wake.filter((f) => f.applyPolicy === "auto")).toMatchObject([
      { ruleId: "cian-095-nbsp-не", before: " " },
    ]);
    expect(applyAllRules("не будите спящего", allRules())).toBe(`не${nbsp}будите спящего`);

    const willBe = fixesFor("вы будете дома", allRules());
    expect(willBe.filter((f) => f.ruleId === pairId)).toMatchObject([
      { applyPolicy: "choice", before: "будете", choiceOptions: ["будите", "будете"] },
    ]);
    expect(willBe.filter((f) => f.applyPolicy === "confirm")).toMatchObject([
      { ruleId: "cian-138-sentence-start-capitalize", before: "в", after: "В" },
    ]);
    expect(willBe.filter((f) => f.applyPolicy === "auto")).toEqual([]);
    expect(applyAllRules("вы будете дома", allRules())).toBe("вы будете дома");

    const polite = fixesFor("Будьте внимательны", allRules());
    expect(polite).toEqual([]);
    expect(applyAllRules("Будьте внимательны", allRules())).toBe("Будьте внимательны");
    expect(checkSpellingFixes("не будите спящего")).toEqual([]);
    expect(checkSpellingFixes("вы будете дома")).toEqual([]);
    expect(checkSpellingFixes("Будьте внимательны")).toEqual([]);

    expect(
      fixesFor("напишите мне", allRules()).some((f) => f.ruleId === "cian-choice-napishite-napishete"),
    ).toBe(true);
    expect(
      fixesFor("пишите письма", allRules()).some((f) => f.ruleId === "cian-choice-pishite-pishete"),
    ).toBe(true);
    expect(
      fixesFor("ждите нас", allRules()).some((f) => f.ruleId === "cian-choice-zhdite-zhdyote"),
    ).toBe(true);
  });

  it("#38 раскладка ,elbnt / ,elbntg не склеивается с Не", () => {
    for (const latin of [",elbnt", ",elbntg"]) {
      const source = `Не ${latin} медведя!`;
      const afterAuto = applyAllRules(source, allRules());
      expect(afterAuto).toMatch(new RegExp(`^Не[\\u00a0 ]${latin.replace(",", "\\,")} медведя!$`));
      const layout = checkSpellingFixes(afterAuto).find((f) => f.before === latin);
      expect(layout?.after).toBe("будите");
      const applied = afterAuto.slice(0, layout!.from) + layout!.after + afterAuto.slice(layout!.to);
      expect(applied).toMatch(/^Не[\u00a0 ]будите медведя!$/);
      expect(checkSpellingFixes(applied).some((f) => /небудите/i.test(f.before))).toBe(false);
    }
    expect(applyAllRules("слово , ещё", allRules())).toMatch(/^слово,[\u00a0 ]ещё$/);
  });

  it("#39 повторный запуск словаря не качает .dic при том же ETag", async () => {
    const aff = "SET UTF-8\n";
    const dic = "2\nтест\nслово\n";
    expect(readResponseEtag({ headers: undefined })).toBeNull();
    const cache = createMemorySpellDictionaryCache();
    let etag = '"dic-1"';
    const fetchFile = vi.fn(async (url: string, known: string | null) => {
      const fileEtag = url.includes(".aff") ? '"aff-1"' : etag;
      if (known && known === fileEtag) return { kind: "not-modified" as const };
      return {
        kind: "body" as const,
        text: url.includes(".aff") ? aff : dic,
        etag: fileEtag,
      };
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    try {
      const first = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        async () => {
          throw new Error("fetchText не должен вызываться");
        },
        { fetchFile, cache },
      );
      expect(first.ok).toBe(true);
      expect(logs.some((line) => line.includes("spell dictionary bytes"))).toBe(true);
      logs.length = 0;
      const second = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        async () => {
          throw new Error("fetchText не должен вызываться");
        },
        { fetchFile, cache },
      );
      expect(second.ok).toBe(true);
      expect(logs.some((line) => line.includes("spell dictionary bytes"))).toBe(false);
      expect(logs.some((line) => line.includes("spell dictionary cache hit, hash"))).toBe(true);

      const empty = createMemorySpellDictionaryCache();
      const offline = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        async () => "",
        {
          cache: empty,
          fetchFile: async () => {
            throw new Error("offline");
          },
        },
      );
      expect(offline.ok).toBe(false);
      expect(offline.entryCount).toBe(0);

      const localOnly = createMemorySpellDictionaryCache();
      const fetchAgain = vi.fn(async (url: string) => ({
        kind: "body" as const,
        text: url.includes(".aff") ? aff : dic,
        etag: null,
      }));
      await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        async () => "",
        { fetchFile: fetchAgain, cache: localOnly },
      );
      fetchAgain.mockClear();
      const cached = localOnly.snapshot();
      expect(cached && spellDictionaryCacheSkipsNetwork(cached)).toBe(true);
      const repeat = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        async () => "",
        { fetchFile: fetchAgain, cache: localOnly },
      );
      expect(repeat.ok).toBe(true);
      expect(fetchAgain).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      loadTestDictionary();
      await ensureSpellCheckerReady();
    }
  }, 60_000);

  it("#40 suggest один раз, лимит карточек, раскладка и whitelist", () => {
    resetSpellSuggestionCache();
    expect(checkSpellingFixes("Кватира")[0]).toMatchObject({
      before: "Кватира",
      after: "Квартира",
      applyPolicy: "confirm",
    });
    const misses = getSpellSuggestMissCount();
    expect(misses).toBe(1);
    expect(checkSpellingFixes("Кватира в доме").find((f) => f.before === "Кватира")?.after).toBe(
      "Квартира",
    );
    expect(getSpellSuggestMissCount()).toBe(misses);

    resetSpellSuggestionCache();
    expect(checkSpellingFixes("Наберите ghbdtn в чат").find((f) => f.before === "ghbdtn")?.after).toBe(
      "привет",
    );
    const mixed = checkSpellingFixes("Заполните ваш yпишете или yпишите, псина!");
    expect(mixed.filter((f) => f.before === "yпишете" || f.before === "yпишите").map((f) => f.after)).toEqual([
      "пишете",
      "пишите",
    ]);
    expect(getSpellSuggestMissCount()).toBe(0);
    expect(
      checkSpellingFixes("Отправьте смс, макет в Figma online").some(
        (f) => f.before === "смс" || f.before === "Figma" || f.before === "online",
      ),
    ).toBe(false);

    resetSpellSuggestionCache();
    const letters = "абвгдежзиклмнопрстуфхцчшщыэюя";
    const junk = Array.from({ length: 20 }, (_, i) => `ъъъ${letters[i] ?? "а"}ффжж`).join(" ");
    const cards = checkSpellingFixes(junk).filter((f) => f.ruleId === ORTHOGRAPHY_SPELL_RULE_ID);
    expect(cards.length).toBeLessThanOrEqual(MAX_SPELL_CARDS_PER_TEXT);
    expect(getSpellSuggestMissCount()).toBeLessThanOrEqual(MAX_SPELL_CARDS_PER_TEXT);
  }, 60_000);

  it("#18 auto typography sample", () => {
    const { fixes } = checkTextForAutofixes("да - нет", allRules());
    expect(fixes.some((f) => f.applyPolicy === "auto")).toBe(true);
  });
});
