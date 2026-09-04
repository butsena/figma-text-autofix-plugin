import { describe, expect, it } from "vitest";
import {
  fetchUrlWithCacheBust,
  formatFetchError,
  looksLikeHtmlResponse,
  previewResponseText,
} from "./remote-fetch";

describe("remote-fetch", () => {
  it("fetchUrlWithCacheBust добавляет ?t= к URL без query", () => {
    const url = fetchUrlWithCacheBust("https://example.com/a.txt");
    expect(url).toMatch(/^https:\/\/example\.com\/a\.txt\?t=\d+$/);
  });

  it("fetchUrlWithCacheBust добавляет &t= к URL с query", () => {
    const url = fetchUrlWithCacheBust("https://example.com/a.txt?x=1");
    expect(url).toMatch(/^https:\/\/example\.com\/a\.txt\?x=1&t=\d+$/);
  });

  it("formatFetchError читает Error.message и строку", () => {
    expect(formatFetchError(new Error("сеть упала"))).toBe("сеть упала");
    expect(formatFetchError("oops")).toBe("oops");
  });

  it("formatFetchError читает message/reason/description из объекта", () => {
    expect(formatFetchError({ message: "msg" })).toBe("msg");
    expect(formatFetchError({ reason: "why" })).toBe("why");
    expect(formatFetchError({ description: "desc" })).toBe("desc");
  });

  it("formatFetchError даёт fallback для пустого объекта", () => {
    expect(formatFetchError({})).toBe("Сетевая ошибка при загрузке.");
    expect(formatFetchError(null)).toBe("Сетевая ошибка при загрузке.");
  });

  it("looksLikeHtmlResponse ловит HTML и пропускает текст", () => {
    expect(looksLikeHtmlResponse("<!DOCTYPE html>")).toBe(true);
    expect(looksLikeHtmlResponse("  <html>")).toBe(true);
    expect(looksLikeHtmlResponse("ищите - ищете - подсказка")).toBe(false);
  });

  it("previewResponseText сжимает пробелы и обрезает", () => {
    expect(previewResponseText("a\n\nb")).toBe("a b");
    expect(previewResponseText("x".repeat(100), 10)).toBe(`${"x".repeat(10)}…`);
  });
});
