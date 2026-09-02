import { describe, expect, it } from "vitest";
import { mergeLexiconLoadStatus } from "./refresh-lexicon";
import type {
  RefreshBoundaryExceptionsResult,
  RefreshLexiconReplacementsResult,
  RefreshSpellDictionaryResult,
} from "./refresh-from-remote";

describe("mergeLexiconLoadStatus", () => {
  it("собирает вложенный статус замен, исключений и орфографии", () => {
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
    const spellDictionary: RefreshSpellDictionaryResult = {
      ok: true,
      entryCount: 146269,
      fromRemote: true,
      fetchUrl: "https://example.com/ru_RU.dic",
    };
    const spellSupplement = {
      ok: true,
      wordCount: 12,
      fromRemote: false,
    };
    const spellWhitelist = {
      ok: true,
      wordCount: 13,
      fromRemote: true,
      fetchUrl: "https://example.com/spell-whitelist.txt",
    };

    expect(
      mergeLexiconLoadStatus(
        replacements,
        boundary,
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
    });
  });
});
