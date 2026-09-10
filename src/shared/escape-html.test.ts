import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("экранирует спецсимволы", () => {
    expect(escapeHtml(`<"&'>`)).toBe("&lt;&quot;&amp;&#039;&gt;");
  });

  it("приводит не-строки к строке", () => {
    expect(escapeHtml(null)).toBe("null");
    expect(escapeHtml(42)).toBe("42");
  });
});
