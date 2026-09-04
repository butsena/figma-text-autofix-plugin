import { describe, expect, it } from "vitest";
import { LEXICON_REMOTE } from "./lexicon-remote-config";
import { SPELLCHECK_ENABLED } from "./feature-flags";

describe("lexicon-remote-config", () => {
  it("все raw URL указывают на butsena/* и ветку main", () => {
    const urls = [
      LEXICON_REMOTE.replacements.url,
      LEXICON_REMOTE.boundaryExceptions.url,
      LEXICON_REMOTE.ambiguousFormChoices.url,
      LEXICON_REMOTE.spellDictionary.affUrl,
      LEXICON_REMOTE.spellDictionary.dicUrl,
      LEXICON_REMOTE.spellSupplement.url,
      LEXICON_REMOTE.spellWhitelist.url,
    ];
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/butsena\//);
      expect(url).toContain("/main/");
    }
  });

  it("файлы словарей имеют ожидаемые имена", () => {
    expect(LEXICON_REMOTE.replacements.url).toContain("text-replacements.csv");
    expect(LEXICON_REMOTE.boundaryExceptions.url).toContain("boundary-exceptions.txt");
    expect(LEXICON_REMOTE.ambiguousFormChoices.url).toContain("ambiguous-form-choices.txt");
    expect(LEXICON_REMOTE.spellDictionary.affUrl).toContain("ru_RU.aff");
    expect(LEXICON_REMOTE.spellDictionary.dicUrl).toContain("ru_RU.dic");
  });
});

describe("feature-flags", () => {
  it("публичная сборка держит орфографию выключенной", () => {
    expect(SPELLCHECK_ENABLED).toBe(false);
  });
});
