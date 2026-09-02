import { describe, expect, it } from "vitest";
import { parseSpellWordList } from "./spell-word-list-parse";

describe("parseSpellWordList", () => {
  it("игнорирует комментарии и пустые строки", () => {
    expect(parseSpellWordList("# коммент\n\nслово\n# ещё\nслово\n")).toEqual(["слово"]);
  });

  it("убирает дубликаты без учёта регистра", () => {
    expect(parseSpellWordList("Циан\ncian\nЦИАН\n")).toEqual(["Циан", "cian"]);
  });
});
