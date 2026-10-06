import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: false,
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
    refreshSpellDictionaryFromRemote: vi.fn(),
    refreshSpellSupplementFromRemote: vi.fn(),
    refreshSpellWhitelistFromRemote: vi.fn(),
  };
});

import {
  refreshAmbiguousFormChoicesFromRemote,
  refreshBoundaryExceptionsFromRemote,
  refreshSpellDictionaryFromRemote,
  refreshTextReplacementsFromRemote,
  type RefreshAmbiguousFormChoicesResult,
  type RefreshBoundaryExceptionsResult,
  type RefreshLexiconReplacementsResult,
  type RefreshSpellDictionaryResult,
  type RefreshSpellWordListResult,
} from "./refresh-from-remote";
import {
  mergeLexiconLoadStatus,
  refreshLexiconFromRemote,
  resetLexiconLoadCache,
} from "./refresh-lexicon";

describe("mergeLexiconLoadStatus", () => {
  it("собирает вложенный статус замен, исключений, choice-пар и орфографии", () => {
    const replacements: RefreshLexiconReplacementsResult = {
      ok: true,
      ruleCount: 10,
      fromRemote: true,
    };
    const boundary: RefreshBoundaryExceptionsResult = {
      ok: true,
      phraseCount: 11,
      fromRemote: true,
      fetchUrl: "https://example.com/boundary-exceptions.txt",
    };
    const choices: RefreshAmbiguousFormChoicesResult = {
      ok: true,
      choiceCount: 2,
      fromRemote: true,
      fetchUrl: "https://example.com/ambiguous-form-choices.txt",
    };
    const spellDictionary: RefreshSpellDictionaryResult = {
      ok: true,
      entryCount: 146269,
      fromRemote: true,
      fetchUrl: "https://example.com/ru_RU.dic",
    };
    const spellSupplement: RefreshSpellWordListResult = {
      ok: true,
      wordCount: 12,
      fromRemote: false,
    };
    const spellWhitelist: RefreshSpellWordListResult = {
      ok: true,
      wordCount: 13,
      fromRemote: true,
      fetchUrl: "https://example.com/spell-whitelist.txt",
    };

    expect(
      mergeLexiconLoadStatus(
        replacements,
        boundary,
        choices,
        spellDictionary,
        spellSupplement,
        spellWhitelist,
      ),
    ).toEqual({
      replacements: {
        ok: true,
        count: 10,
        fromRemote: true,
      },
      boundaryExceptions: {
        ok: true,
        count: 11,
        fromRemote: true,
        fetchUrl: "https://example.com/boundary-exceptions.txt",
      },
      ambiguousFormChoices: {
        ok: true,
        count: 2,
        fromRemote: true,
        fetchUrl: "https://example.com/ambiguous-form-choices.txt",
      },
      spellDictionary: {
        ok: true,
        count: 146269,
        fromRemote: true,
        fetchUrl: "https://example.com/ru_RU.dic",
      },
      spellSupplement: {
        ok: true,
        count: 12,
        fromRemote: false,
      },
      spellWhitelist: {
        ok: true,
        count: 13,
        fromRemote: true,
        fetchUrl: "https://example.com/spell-whitelist.txt",
      },
      spellExtraUniqueCount: expect.any(Number),
    });
    expect(
      mergeLexiconLoadStatus(
        replacements,
        boundary,
        choices,
        spellDictionary,
        spellSupplement,
        spellWhitelist,
      ).spellExtraUniqueCount,
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("refreshLexiconFromRemote with SPELLCHECK_ENABLED=false", () => {
  beforeEach(() => {
    resetLexiconLoadCache();
    vi.clearAllMocks();
  });

  it("грузит три рабочих словаря и не трогает spell remote", async () => {
    const status = await refreshLexiconFromRemote({ force: true });
    expect(refreshTextReplacementsFromRemote).toHaveBeenCalled();
    expect(refreshBoundaryExceptionsFromRemote).toHaveBeenCalled();
    expect(refreshAmbiguousFormChoicesFromRemote).toHaveBeenCalled();
    expect(refreshSpellDictionaryFromRemote).not.toHaveBeenCalled();
    expect(status.replacements).toMatchObject({ ok: true, count: 5, fromRemote: true });
    expect(status.spellDictionary).toMatchObject({ ok: true, count: 0, fromRemote: false });
    expect(status.spellSupplement).toMatchObject({ ok: true, count: 0, fromRemote: false });
    expect(status.spellWhitelist).toMatchObject({ ok: true, count: 0, fromRemote: false });
  });

  it("кэширует статус между вызовами без force", async () => {
    await refreshLexiconFromRemote({ force: true });
    const calls = vi.mocked(refreshTextReplacementsFromRemote).mock.calls.length;
    await refreshLexiconFromRemote();
    expect(vi.mocked(refreshTextReplacementsFromRemote).mock.calls.length).toBe(calls);
  });

  it("includeSpell:false не трогает spell remote", async () => {
    const status = await refreshLexiconFromRemote({ force: true, includeSpell: false });
    expect(refreshSpellDictionaryFromRemote).not.toHaveBeenCalled();
    expect(status.spellDictionary.count).toBe(0);
  });
});
