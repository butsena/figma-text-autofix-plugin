import { describe, expect, it } from "vitest";
import { mergeLexiconLoadStatus } from "./refresh-lexicon";
import type {
  RefreshBoundaryExceptionsResult,
  RefreshLexiconReplacementsResult,
} from "./refresh-from-remote";

describe("mergeLexiconLoadStatus", () => {
  it("собирает вложенный статус замен и исключений границ", () => {
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

    expect(mergeLexiconLoadStatus(replacements, boundary)).toEqual({
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
    });
  });
});
