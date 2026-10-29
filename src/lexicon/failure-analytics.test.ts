import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  refreshTextReplacementsFromRemote, refreshBoundaryExceptionsFromRemote,
  refreshAmbiguousFormChoicesFromRemote, refreshSpellSupplementFromRemote,
  refreshSpellWhitelistFromRemote, refreshSpellDictionaryFromRemote,
} from "./refresh-from-remote";
import { createMemorySpellDictionaryCache, SPELL_DICTIONARY_CACHE_TTL_MS } from "../spell/spell-dictionary-cache";
import { clearHunspellDictionary } from "../spell/hunspell-dictionary-store";
import { resetSpellCheckerCache } from "../spell/spell-checker";

const trackAnalytics = vi.hoisted(() => vi.fn());
vi.mock("../analytics/track", () => ({ trackAnalytics }));
const offline = async () => { throw new Error("PRIVATE url/name/stack"); };

describe("T-144: real dictionary fallback paths", () => {
  beforeEach(() => {
    trackAnalytics.mockClear();
    clearHunspellDictionary();
    resetSpellCheckerCache();
  });
  it("records five independent bundled recoveries without copying failure text", async () => {
    const loads = [refreshTextReplacementsFromRemote, refreshBoundaryExceptionsFromRemote,
      refreshAmbiguousFormChoicesFromRemote, refreshSpellSupplementFromRemote, refreshSpellWhitelistFromRemote];
    for (const load of loads) await load("https://fixture.invalid/resource", offline);
    expect(trackAnalytics).toHaveBeenCalledTimes(5);
    expect(trackAnalytics.mock.calls.map(([, p]) => p.resource)).toEqual([
      "replacements", "boundary_exceptions", "ambiguous_forms", "spell_supplement", "spell_whitelist",
    ]);
    expect(trackAnalytics.mock.calls.every(([, p]) => p.outcome === "recovered" && p.recovery === "bundled")).toBe(true);
    expect(JSON.stringify(trackAnalytics.mock.calls)).not.toMatch(/PRIVATE|fixture/);
  });
  it("missing remote Hunspell without usable cache is one failure, not a recovery", async () => {
    const result = await refreshSpellDictionaryFromRemote("https://fixture/a.aff", "https://fixture/a.dic", offline, { cache: null });
    expect(result.ok).toBe(false);
    expect(trackAnalytics).toHaveBeenCalledExactlyOnceWith("plugin_error", {
      stage: "spell", code: "spell_load_failed", outcome: "failed", resource: "spell_dictionary",
    });
  });
  it("expired usable Hunspell cache recovers once; a fresh cache hit is normal operation", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const cache = createMemorySpellDictionaryCache();
      const fetchText = async (url: string) => url.includes(".aff") ? "SET UTF-8\n" : "2\nтест\nслово\n";
      await refreshSpellDictionaryFromRemote("https://fixture/a.aff", "https://fixture/a.dic", fetchText, { cache });
      expect(trackAnalytics).not.toHaveBeenCalled();
      await refreshSpellDictionaryFromRemote("https://fixture/a.aff", "https://fixture/a.dic", offline, { cache });
      expect(trackAnalytics).not.toHaveBeenCalled();
      clock.mockReturnValue(now + SPELL_DICTIONARY_CACHE_TTL_MS + 1);
      const recovered = await refreshSpellDictionaryFromRemote("https://fixture/a.aff", "https://fixture/a.dic", offline, { cache });
      expect(recovered.ok).toBe(true);
      expect(trackAnalytics).toHaveBeenCalledExactlyOnceWith("plugin_error", {
        stage: "spell", code: "spell_load_failed", outcome: "recovered", resource: "spell_dictionary", recovery: "cache",
      });
    } finally { clock.mockRestore(); }
  });
  it("intentional bundled/disabled configuration is not a recovery or failure", async () => {
    await refreshTextReplacementsFromRemote("", offline);
    await refreshSpellDictionaryFromRemote("", "", offline, { cache: null });
    expect(trackAnalytics).not.toHaveBeenCalled();
  });
});
