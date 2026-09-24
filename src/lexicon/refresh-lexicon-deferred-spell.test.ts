import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

vi.mock("./refresh-from-remote", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./refresh-from-remote")>();
  return {
    ...actual,
    fetchRemoteTextViaHttp: vi.fn(),
    refreshTextReplacementsFromRemote: vi.fn(async () => ({
      ok: true,
      ruleCount: 5,
      fromRemote: true,
      fetchUrl: "https://example.com/replacements.csv",
    })),
    refreshBoundaryExceptionsFromRemote: vi.fn(async () => ({
      ok: true,
      phraseCount: 3,
      fromRemote: true,
      fetchUrl: "https://example.com/boundary.txt",
    })),
    refreshAmbiguousFormChoicesFromRemote: vi.fn(async () => ({
      ok: true,
      choiceCount: 4,
      fromRemote: true,
      fetchUrl: "https://example.com/choices.txt",
    })),
    refreshSpellDictionaryFromRemote: vi.fn(async () => ({
      ok: true,
      entryCount: 146269,
      fromRemote: true,
      fetchUrl: "https://example.com/ru_RU.dic",
    })),
    refreshSpellSupplementFromRemote: vi.fn(async () => ({
      ok: true,
      wordCount: 2,
      fromRemote: true,
    })),
    refreshSpellWhitelistFromRemote: vi.fn(async () => ({
      ok: true,
      wordCount: 3,
      fromRemote: true,
    })),
  };
});

import {
  refreshSpellDictionaryFromRemote,
  refreshTextReplacementsFromRemote,
} from "./refresh-from-remote";
import {
  refreshLexiconFromRemote,
  refreshSpellLexiconFromRemote,
  resetLexiconLoadCache,
} from "./refresh-lexicon";

describe("deferred spell lexicon load", () => {
  beforeEach(() => {
    resetLexiconLoadCache();
    vi.clearAllMocks();
  });

  it("быстрый старт без spell, затем догрузка Hunspell", async () => {
    const editorial = await refreshLexiconFromRemote({ force: true, includeSpell: false });
    expect(refreshSpellDictionaryFromRemote).not.toHaveBeenCalled();
    expect(editorial.spellDictionary.count).toBe(0);
    expect(editorial.replacements.count).toBe(5);

    const withSpell = await refreshSpellLexiconFromRemote();
    expect(refreshSpellDictionaryFromRemote).toHaveBeenCalledOnce();
    expect(refreshTextReplacementsFromRemote).toHaveBeenCalledOnce();
    expect(withSpell.spellDictionary.count).toBe(146269);
    expect(withSpell.replacements.count).toBe(5);
  });

  it("повторный refresh без force догружает spell, если его ещё нет", async () => {
    await refreshLexiconFromRemote({ force: true, includeSpell: false });
    const again = await refreshLexiconFromRemote();
    expect(refreshSpellDictionaryFromRemote).toHaveBeenCalledOnce();
    expect(again.spellDictionary.count).toBe(146269);
  });
});
