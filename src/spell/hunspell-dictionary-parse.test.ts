import { describe, expect, it } from "vitest";
import { parseHunspellDictionary } from "./hunspell-dictionary-parse";

describe("parseHunspellDictionary", () => {
  it("принимает валидную пару aff/dic", () => {
    const aff = "SET UTF-8\n";
    const dic = "2\nhello\nworld\n";
    expect(parseHunspellDictionary(aff, dic)).toEqual({
      aff: "SET UTF-8",
      dic: "2\nhello\nworld",
      entryCount: 2,
    });
  });

  it("отклоняет HTML и битый заголовок", () => {
    expect(parseHunspellDictionary("<!DOCTYPE html>", "1\nx\n")).toBeNull();
    expect(parseHunspellDictionary("SET UTF-8\n", "not-a-number\nx\n")).toBeNull();
  });
});
