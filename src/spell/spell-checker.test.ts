import { beforeEach, describe, expect, it, vi } from "vitest";

const getDict = vi.fn();
const getStats = vi.fn();
const getExtra = vi.fn(() => [] as string[]);

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

vi.mock("./hunspell-dictionary-store", () => ({
  HUNSPELL_SOURCE: "test",
  getHunspellDictionary: () => getDict(),
  getHunspellDictionaryLoadStats: () => getStats(),
}));

vi.mock("./spell-word-list-store", () => ({
  getAllSpellExtraWords: () => getExtra(),
}));

vi.mock("nspell", () => {
  return {
    default: () => {
      const words = new Set<string>(["ошибка", "квартира"]);
      return {
        add: (w: string) => words.add(w),
        correct: (w: string) => words.has(w),
        suggest: (w: string) => {
          if (w === "ашыбка" || w === "Ашыбка") return ["ошибка"];
          if (w.toLowerCase() === "ашыбка") return ["ошибка"];
          return [];
        },
      };
    },
  };
});

describe("spell-checker", () => {
  beforeEach(async () => {
    getDict.mockReset();
    getStats.mockReset();
    getExtra.mockReset();
    getExtra.mockReturnValue([]);
    getStats.mockReturnValue({ fromRemote: true, entryCount: 2, ok: true, count: 2 });
    getDict.mockReturnValue({ aff: "AFF", dic: "DIC", entryCount: 2 });
    vi.resetModules();
  });

  it("isKnownWord и suggestCorrection", async () => {
    const {
      ensureSpellCheckerReady,
      getSpellSuggestMissCount,
      isKnownWord,
      suggestCorrection,
      resetSpellCheckerCache,
    } = await import("./spell-checker");
    resetSpellCheckerCache();
    const spell = await ensureSpellCheckerReady();
    expect(spell).not.toBeNull();
    expect(isKnownWord(spell!, "ошибка")).toBe(true);
    expect(isKnownWord(spell!, "Ошибка")).toBe(true);
    expect(isKnownWord(spell!, "ашыбка")).toBe(false);
    expect(suggestCorrection(spell!, "ашыбка")).toBe("ошибка");
    expect(suggestCorrection(spell!, "Ашыбка")).toBe("ошибка");
    expect(getSpellSuggestMissCount()).toBe(1);
    expect(suggestCorrection(spell!, "zzzzzz")).toBeNull();
    expect(getSpellSuggestMissCount()).toBe(2);
  });

  it("concurrent ensureSpellCheckerReady шарит один promise", async () => {
    const { ensureSpellCheckerReady, resetSpellCheckerCache } = await import("./spell-checker");
    resetSpellCheckerCache();
    const [a, b] = await Promise.all([ensureSpellCheckerReady(), ensureSpellCheckerReady()]);
    expect(a).toBe(b);
  });

  it("инвалидирует кэш при смене словаря", async () => {
    const {
      ensureSpellCheckerReady,
      getSpellChecker,
      resetSpellCheckerCache,
    } = await import("./spell-checker");
    resetSpellCheckerCache();
    await ensureSpellCheckerReady();
    expect(getSpellChecker()).not.toBeNull();

    getStats.mockReturnValue({ fromRemote: true, entryCount: 99, ok: true, count: 99 });
    getDict.mockReturnValue({ aff: "AFF2", dic: "DIC2", entryCount: 99 });
    getExtra.mockReturnValue(["новое"]);
    const next = await ensureSpellCheckerReady();
    expect(next).not.toBeNull();
  });
});
