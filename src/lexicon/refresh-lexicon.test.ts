import { describe, expect, it } from "vitest";
import { mergeLexiconLoadStatus } from "./refresh-lexicon";
import type {
  RefreshAmbiguousFormChoicesResult,
  RefreshBoundaryExceptionsResult,
  RefreshLexiconReplacementsResult,
} from "./refresh-from-remote";

describe("mergeLexiconLoadStatus", () => {
  it("собирает вложенный статус замен, исключений границ и пар choice-правил", () => {
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

    expect(mergeLexiconLoadStatus(replacements, boundary, choices)).toEqual({
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
    });
  });
});
