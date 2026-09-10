import { beforeEach, describe, expect, it } from "vitest";
import {
  applyHunspellDictionaryFromRaw,
  clearHunspellDictionary,
  getHunspellDictionary,
  getHunspellDictionaryLoadStats,
} from "./hunspell-dictionary-store";

describe("hunspell-dictionary-store", () => {
  beforeEach(() => {
    clearHunspellDictionary();
  });

  it("после clear словарь пуст", () => {
    expect(getHunspellDictionary()).toBeNull();
    expect(getHunspellDictionaryLoadStats()).toEqual({ entryCount: 0, fromRemote: false });
  });

  it("принимает валидный aff+dic", () => {
    const ok = applyHunspellDictionaryFromRaw("SET UTF-8\n", "2\nкот\nпёс\n");
    expect(ok).toBe(true);
    expect(getHunspellDictionary()?.entryCount).toBeGreaterThan(0);
    expect(getHunspellDictionaryLoadStats().fromRemote).toBe(true);
  });

  it("отклоняет HTML и не портит активный словарь", () => {
    expect(applyHunspellDictionaryFromRaw("SET UTF-8\n", "1\nслово\n")).toBe(true);
    const before = getHunspellDictionaryLoadStats();
    expect(applyHunspellDictionaryFromRaw("<!DOCTYPE html>", "1\nx\n")).toBe(false);
    expect(getHunspellDictionaryLoadStats()).toEqual(before);
  });
});
