import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHunspellDictionary } from "../spell/hunspell-dictionary-store";
import { resetSpellCheckerCache } from "../spell/spell-checker";
import {
  resetSpellSupplementToBundled,
  resetSpellWhitelistToBundled,
} from "../spell/spell-word-list-store";
import {
  refreshSpellDictionaryFromRemote,
  refreshSpellSupplementFromRemote,
  refreshSpellWhitelistFromRemote,
} from "./refresh-spell-from-remote";

describe("refresh-spell-from-remote", () => {
  beforeEach(() => {
    resetSpellSupplementToBundled();
    resetSpellWhitelistToBundled();
    clearHunspellDictionary();
    resetSpellCheckerCache();
  });

  it("supplement: пустой URL → bundled", async () => {
    const result = await refreshSpellSupplementFromRemote("", async () => "");
    expect(result.ok).toBe(true);
    expect(result.fromRemote).toBe(false);
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("supplement: подставляет remote-список", async () => {
    const result = await refreshSpellSupplementFromRemote(
      "https://example.com/supplement.txt",
      async () => "Циан\nновостройка\n",
    );
    expect(result).toMatchObject({ ok: true, fromRemote: true, wordCount: 2 });
  });

  it("supplement: HTML → ошибка и bundled count", async () => {
    const bundled = (await refreshSpellSupplementFromRemote("", async () => "")).wordCount;
    const result = await refreshSpellSupplementFromRemote(
      "https://example.com/supplement.txt",
      async () => "<!DOCTYPE html>",
    );
    expect(result.ok).toBe(false);
    expect(result.wordCount).toBe(bundled);
  });

  it("whitelist: сетевая ошибка → fallback", async () => {
    const bundled = (await refreshSpellWhitelistFromRemote("", async () => "")).wordCount;
    const fetch = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await refreshSpellWhitelistFromRemote(
      "https://example.com/whitelist.txt",
      fetch,
    );
    expect(result.ok).toBe(false);
    expect(result.wordCount).toBe(bundled);
    expect(result.errorMessage).toContain("timeout");
  });

  it("dictionary: пустые URL → без remote", async () => {
    const result = await refreshSpellDictionaryFromRemote("", "", async () => "");
    expect(result).toMatchObject({ ok: true, fromRemote: false, entryCount: 0 });
  });

  it("dictionary: HTML → ошибка", async () => {
    const result = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async () => "<html>err</html>",
    );
    expect(result.ok).toBe(false);
    expect(result.fromRemote).toBe(false);
    expect(result.entryCount).toBe(0);
  });

  it("dictionary: валидные aff+dic → fromRemote", async () => {
    const aff = "SET UTF-8\n";
    const dic = "2\nтест\nслово\n";
    const result = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async (url) => (url.includes(".aff") ? aff : dic),
    );
    expect(result.ok).toBe(true);
    expect(result.fromRemote).toBe(true);
    expect(result.entryCount).toBeGreaterThan(0);
  });
});
