import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ungzip } from "pako";
import { decodeBase64ToBytes, utf8BytesToString } from "./utf8-bytes-to-string";

describe("utf8BytesToString", () => {
  it("декодирует кириллицу без TextDecoder", () => {
    const encoded = new TextEncoder().encode("квартира ёж");
    expect(utf8BytesToString(encoded)).toBe("квартира ёж");
  });
});

describe("decodeGzipBase64 path", () => {
  it("разжимает gzip+base64 в текст без toText", () => {
    const original = "SET UTF-8\n2\nквартира\n";
    const b64 = gzipSync(Buffer.from(original, "utf8")).toString("base64");
    const text = utf8BytesToString(ungzip(decodeBase64ToBytes(b64)));
    expect(text).toBe(original);
  });

  it("работает, если в окружении нет TextDecoder", () => {
    const original = new TextEncoder();
    const saved = globalThis.TextDecoder;
    // @ts-expect-error test sandbox
    delete globalThis.TextDecoder;
    try {
      const bytes = original.encode("ипотека");
      expect(utf8BytesToString(bytes)).toBe("ипотека");
    } finally {
      globalThis.TextDecoder = saved;
    }
  });
});
