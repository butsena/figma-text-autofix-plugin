import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHunspellDictionary } from "../spell/hunspell-dictionary-store";
import { resetSpellCheckerCache } from "../spell/spell-checker";
import { createMemorySpellDictionaryCache, SPELL_DICTIONARY_CACHE_TTL_MS } from "../spell/spell-dictionary-cache";
import {
  resetSpellSupplementToBundled,
  resetSpellWhitelistToBundled,
} from "../spell/spell-word-list-store";
import {
  refreshSpellDictionaryFromRemote,
  refreshSpellSupplementFromRemote,
  refreshSpellWhitelistFromRemote,
  fetchSpellDictionaryFile,
  readResponseEtag,
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
    const urls: string[] = [];
    const result = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async (url) => {
        urls.push(url);
        return url.includes(".aff") ? aff : dic;
      },
    );
    expect(result.ok).toBe(true);
    expect(result.fromRemote).toBe(true);
    expect(result.entryCount).toBeGreaterThan(0);
    expect(urls).toEqual(["https://example.com/a.aff", "https://example.com/a.dic"]);
  });

  it("повторный запуск с тем же ETag не качает тело и не логирует bytes", async () => {
    const aff = "SET UTF-8\n";
    const dic = "2\nтест\nслово\n";
    const cache = createMemorySpellDictionaryCache();
    const fetchText = vi.fn(async (url: string) => (url.includes(".aff") ? aff : dic));
    let affEtag = '"aff-1"';
    let dicEtag = '"dic-1"';
    let dicBody = dic;
    const fetchFile = vi.fn(async (url: string, known: string | null) => {
      const etag = url.includes(".aff") ? affEtag : dicEtag;
      if (known && known === etag) return { kind: "not-modified" as const };
      const text = url.includes(".aff") ? aff : dicBody;
      return { kind: "body" as const, text, etag };
    });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });

    try {
      const first = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        fetchText,
        { fetchFile, cache },
      );
      expect(first.ok).toBe(true);
      expect(fetchText).not.toHaveBeenCalled();
      expect(logs.some((line) => line.includes("spell dictionary bytes"))).toBe(true);
      expect(cache.snapshot()?.etagDic).toBe('"dic-1"');

      logs.length = 0;
      const second = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        fetchText,
        { fetchFile, cache },
      );
      expect(second).toMatchObject({ ok: true, fromRemote: true, entryCount: first.entryCount });
      expect(fetchText).not.toHaveBeenCalled();
      expect(logs.some((line) => line.includes("spell dictionary bytes"))).toBe(false);
      expect(logs.some((line) => line.includes("spell dictionary cache hit, hash"))).toBe(true);

      dicEtag = '"dic-2"';
      dicBody = "3\nтест\nслово\nещё\n";
      logs.length = 0;
      const third = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        fetchText,
        { fetchFile, cache },
      );
      expect(third.ok).toBe(true);
      expect(third.entryCount).toBe(3);
      expect(logs.some((line) => line.includes("spell dictionary bytes"))).toBe(true);

      fetchFile.mockRejectedValueOnce(new Error("offline"));
      fetchFile.mockRejectedValueOnce(new Error("offline"));
      const offline = await refreshSpellDictionaryFromRemote(
        "https://example.com/a.aff",
        "https://example.com/a.dic",
        fetchText,
        { fetchFile, cache },
      );
      expect(offline.ok).toBe(true);
      expect(offline.entryCount).toBe(3);
    } finally {
      spy.mockRestore();
    }
  });

  it("нет сети и нет локальной копии — орфография выключена", async () => {
    const cache = createMemorySpellDictionaryCache();
    const fetchFile = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async () => "",
      { fetchFile, cache },
    );
    expect(result.ok).toBe(false);
    expect(result.entryCount).toBe(0);
    expect(result.errorMessage).toContain("offline");
  });

  it("fetchSpellDictionaryFile: 304 без тела и без cache-bust", async () => {
    const fetchMock = vi.fn(
      async (url: string, init?: RequestInit) => {
        expect(url).not.toContain("t=");
        expect(init?.cache).toBe("no-store");
        const headers = new Headers(init?.headers);
        expect(headers.get("If-None-Match")).toBe('"abc"');
        return new Response(null, { status: 304 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(fetchSpellDictionaryFile("https://example.com/a.dic", '"abc"')).resolves.toEqual({
        kind: "not-modified",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ответ без headers не роняет загрузку словаря", async () => {
    expect(readResponseEtag({})).toBeNull();
    expect(readResponseEtag({ headers: undefined })).toBeNull();
    expect(readResponseEtag({ headers: { etag: '"plain"' } })).toBe('"plain"');

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        headers: undefined,
        text: async () => "SET UTF-8\n",
      })),
    );
    try {
      await expect(fetchSpellDictionaryFile("https://example.com/a.aff", null)).resolves.toEqual({
        kind: "body",
        text: "SET UTF-8\n",
        etag: null,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ошибка записи кэша не выключает уже скачанный словарь", async () => {
    const aff = "SET UTF-8\n";
    const dic = "1\nтест\n";
    const cache = {
      async get() {
        return null;
      },
      async set() {
        throw new Error("'TextEncoder' is not defined");
      },
    };
    const result = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async (url) => (url.includes(".aff") ? aff : dic),
      { cache },
    );
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBeGreaterThan(0);
    expect(result.errorMessage).toBeUndefined();
  });

  it("без ETag свежий кэш не качает .dic", async () => {
    const aff = "SET UTF-8\n";
    const dic = "1\nтест\n";
    const cache = createMemorySpellDictionaryCache();
    const fetchFile = vi.fn(async (url: string) => ({
      kind: "body" as const,
      text: url.includes(".aff") ? aff : dic,
      etag: null,
    }));
    const first = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async () => "",
      { fetchFile, cache },
    );
    expect(first.ok).toBe(true);
    expect(fetchFile).toHaveBeenCalled();

    fetchFile.mockClear();
    const second = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async () => "",
      { fetchFile, cache },
    );
    expect(second.ok).toBe(true);
    expect(second.entryCount).toBe(first.entryCount);
    expect(fetchFile).not.toHaveBeenCalled();

    const stored = cache.snapshot();
    expect(stored?.savedAt).toEqual(expect.any(Number));
    await cache.set({ ...stored!, savedAt: Date.now() - SPELL_DICTIONARY_CACHE_TTL_MS - 1 });
    const third = await refreshSpellDictionaryFromRemote(
      "https://example.com/a.aff",
      "https://example.com/a.dic",
      async () => "",
      { fetchFile, cache },
    );
    expect(third.ok).toBe(true);
    expect(fetchFile).toHaveBeenCalled();
  });
});
