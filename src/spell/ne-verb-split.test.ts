import { describe, expect, it } from "vitest";
import { APPLY_POLICY_CONFIRM } from "../core/apply-policy";
import { MSG_NE_VERB_SEPARATE } from "../rules/rule-messages";
import {
  NE_VERB_MIN_TAIL,
  NE_VERB_SPLIT_PRIORITY,
  NE_VERB_SPLIT_RULE_ID,
  buildNeVerbFixes,
  isParticipleTail,
  joinNeWithTail,
  looksLikeVerbTail,
  separateNeVerb,
} from "./ne-verb-split";

const known = new Set([
  "отключите",
  "забудьте",
  "откройте",
  "отключить",
  "трогайте",
  "делайте",
  "писали",
  "сделала",
  "бойтесь",
  "смейтесь",
  "смотрите",
  "закрывайте",
  "учусь",
  "учитесь",
  "бойся",
  "будьте",
  "работающий",
  "работавшая",
  "сделанный",
  "сделанное",
  "пишущий",
  "ненавидеть",
  "нельзя",
  "невысокий",
  "неплохо",
  "плохо",
  "высокий",
  "будите",
  "будете",
  "маршрут",
  "канал",
  "привет",
]);

function isKnown(word: string): boolean {
  return known.has(word.toLowerCase());
}

describe("looksLikeVerbTail / isParticipleTail", () => {
  it("узнаёт личные формы и императив, в том числе «йтесь»", () => {
    expect(looksLikeVerbTail("отключите")).toBe(true);
    expect(looksLikeVerbTail("отключить")).toBe(true);
    expect(looksLikeVerbTail("писали")).toBe(true);
    expect(looksLikeVerbTail("сделала")).toBe(true);
    expect(looksLikeVerbTail("бойтесь")).toBe(true);
    expect(looksLikeVerbTail("смейтесь")).toBe(true);
    expect(looksLikeVerbTail("бойся")).toBe(true);
    expect(looksLikeVerbTail("учитесь")).toBe(true);
  });

  it("не принимает существительные с коротким «глагольным» хвостом", () => {
    expect(looksLikeVerbTail("маршрут")).toBe(false);
    expect(looksLikeVerbTail("канал")).toBe(false);
    expect(looksLikeVerbTail("привет")).toBe(false);
    expect(looksLikeVerbTail("плохо")).toBe(false);
    expect(looksLikeVerbTail("высокий")).toBe(false);
  });

  it("отсекает причастия по суффиксу", () => {
    expect(isParticipleTail("работающий")).toBe(true);
    expect(isParticipleTail("работавшая")).toBe(true);
    expect(isParticipleTail("сделанный")).toBe(true);
    expect(isParticipleTail("сделанное")).toBe(true);
    expect(isParticipleTail("пишущий")).toBe(true);
    expect(isParticipleTail("отключите")).toBe(false);
  });
});

describe("joinNeWithTail", () => {
  it("сохраняет регистр обеих частей", () => {
    expect(joinNeWithTail("неотключите")).toBe("не отключите");
    expect(joinNeWithTail("Неотключите")).toBe("Не отключите");
    expect(joinNeWithTail("НЕОТКЛЮЧИТЕ")).toBe("НЕ ОТКЛЮЧИТЕ");
    expect(joinNeWithTail("неОтключите")).toBe("не Отключите");
  });
});

describe("separateNeVerb", () => {
  it("режет слитый глагол и сохраняет регистр «не»", () => {
    expect(separateNeVerb("неотключите", isKnown)).toBe("не отключите");
    expect(separateNeVerb("Неотключите", isKnown)).toBe("Не отключите");
    expect(separateNeVerb("НЕОТКЛЮЧИТЕ", isKnown)).toBe("НЕ ОТКЛЮЧИТЕ");
    expect(separateNeVerb("неОтключите", isKnown)).toBe("не Отключите");
    expect(separateNeVerb("незабудьте", isKnown)).toBe("не забудьте");
    expect(separateNeVerb("неотключить", isKnown)).toBe("не отключить");
    expect(separateNeVerb("неоткройте", isKnown)).toBe("не откройте");
    expect(separateNeVerb("нетрогайте", isKnown)).toBe("не трогайте");
    expect(separateNeVerb("неделайте", isKnown)).toBe("не делайте");
    expect(separateNeVerb("неписали", isKnown)).toBe("не писали");
    expect(separateNeVerb("несделала", isKnown)).toBe("не сделала");
    expect(separateNeVerb("несмотрите", isKnown)).toBe("не смотрите");
    expect(separateNeVerb("незакрывайте", isKnown)).toBe("не закрывайте");
    expect(separateNeVerb("неучитесь", isKnown)).toBe("не учитесь");
    expect(separateNeVerb("небудьте", isKnown)).toBe("не будьте");
  });

  it("режет императив на «йтесь» / «йся»", () => {
    expect(separateNeVerb("небойтесь", isKnown)).toBe("не бойтесь");
    expect(separateNeVerb("несмейтесь", isKnown)).toBe("не смейтесь");
    expect(separateNeVerb("небойся", isKnown)).toBe("не бойся");
  });

  it("не трогает словарные целые слова", () => {
    expect(separateNeVerb("ненавидеть", isKnown)).toBeNull();
    expect(separateNeVerb("нельзя", isKnown)).toBeNull();
    expect(separateNeVerb("неплохо", isKnown)).toBeNull();
    expect(separateNeVerb("невысокий", isKnown)).toBeNull();
  });

  it("не режет причастия, даже если целиком слова нет в словаре", () => {
    expect(separateNeVerb("неработающий", isKnown)).toBeNull();
    const withoutWhole = (word: string) =>
      word.toLowerCase() !== "неработающий" &&
      word.toLowerCase() !== "неработавшая" &&
      word.toLowerCase() !== "несделанный" &&
      word.toLowerCase() !== "непишущий" &&
      isKnown(word);
    expect(separateNeVerb("неработающий", withoutWhole)).toBeNull();
    expect(separateNeVerb("неработавшая", withoutWhole)).toBeNull();
    expect(separateNeVerb("несделанный", withoutWhole)).toBeNull();
    expect(separateNeVerb("непишущий", withoutWhole)).toBeNull();
  });

  it("не трогает слова без префикса «не», короткие хвосты и уже разделённые", () => {
    expect(separateNeVerb("Будьте", isKnown)).toBeNull();
    expect(separateNeVerb("отключите", isKnown)).toBeNull();
    expect(separateNeVerb("не", isKnown)).toBeNull();
    expect(separateNeVerb("несу", isKnown)).toBeNull();
    expect(separateNeVerb("неси", isKnown)).toBeNull();
    expect(separateNeVerb("неешь", isKnown)).toBeNull();
    expect("ешь".length).toBeLessThan(NE_VERB_MIN_TAIL);
  });

  it("не режет, если хвост не глагольный или неизвестен словарю", () => {
    expect(separateNeVerb("немаршрут", isKnown)).toBeNull();
    expect(separateNeVerb("неканал", isKnown)).toBeNull();
    expect(separateNeVerb("непривет", isKnown)).toBeNull();
    expect(separateNeVerb("неотключитехх", isKnown)).toBeNull();
    expect(separateNeVerb("неabcdef", isKnown)).toBeNull();
  });

  it("не режет, если хвост похож на глагол, но словарям неизвестен", () => {
    expect(separateNeVerb("неквартируйте", isKnown)).toBeNull();
  });
});

describe("buildNeVerbFixes", () => {
  it("в тексте карточка только на слитое слово", () => {
    const fixes = buildNeVerbFixes("Пока неотключите уведомления", isKnown);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      before: "неотключите",
      after: "не отключите",
      ruleId: NE_VERB_SPLIT_RULE_ID,
      category: "cian_editorial",
      message: MSG_NE_VERB_SEPARATE,
      priority: NE_VERB_SPLIT_PRIORITY,
      applyPolicy: APPLY_POLICY_CONFIRM,
      from: 5,
      to: 16,
    });
    expect(buildNeVerbFixes("не отключите уведомления", isKnown)).toEqual([]);
    expect(buildNeVerbFixes("Будьте внимательны", isKnown)).toEqual([]);
  });

  it("находит несколько слитных глаголов в одном слое", () => {
    const fixes = buildNeVerbFixes("Неотключите и незабудьте проверить", isKnown);
    expect(fixes.map((f) => f.after)).toEqual(["Не отключите", "не забудьте"]);
  });

  it("уважает skipWord и occupied-диапазоны", () => {
    const text = "Пока неотключите уведомления";
    expect(
      buildNeVerbFixes(text, isKnown, {
        skipWord: (word) => word.toLowerCase() === "неотключите",
      }),
    ).toEqual([]);

    expect(
      buildNeVerbFixes(text, isKnown, {
        occupied: [{ from: 5, to: 16 }],
      }),
    ).toEqual([]);

    expect(
      buildNeVerbFixes(text, isKnown, {
        occupied: [{ from: 0, to: 4 }],
      }).map((f) => f.after),
    ).toEqual(["не отключите"]);
  });

  it("не ставит две карточки на пересекающиеся токены", () => {
    // extractCyrillicWordTokens не даёт пересечений; защита на уровне build всё равно есть.
    const fixes = buildNeVerbFixes("неотключите неотключите", isKnown);
    expect(fixes).toHaveLength(2);
    expect(fixes.map((f) => ({ from: f.from, to: f.to }))).toEqual([
      { from: 0, to: 11 },
      { from: 12, to: 23 },
    ]);
  });
});
