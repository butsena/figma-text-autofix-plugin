import { describe, expect, it } from "vitest";
import { packSpellDictionary, unpackSpellDictionary } from "./spell-dictionary-cache";

describe("spell-dictionary-cache", () => {
  it("сжимает кириллицу без TextEncoder", () => {
    const encoder = globalThis.TextEncoder;
    const decoder = globalThis.TextDecoder;
    Reflect.deleteProperty(globalThis, "TextEncoder");
    Reflect.deleteProperty(globalThis, "TextDecoder");
    try {
      const aff = "SET UTF-8\n";
      const dic = "1\nтест\n";
      const packed = packSpellDictionary(aff, dic, null, null);
      expect(packed).not.toBeNull();
      expect(unpackSpellDictionary(packed!)).toEqual({ aff, dic });
    } finally {
      globalThis.TextEncoder = encoder;
      globalThis.TextDecoder = decoder;
    }
  });
});
