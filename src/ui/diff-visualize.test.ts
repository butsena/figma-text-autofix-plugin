import { describe, expect, it } from "vitest";
import {
  formatDiffHtml,
  isWhitespaceOnlyFragment,
  visualizeDiffFragment,
} from "./diff-visualize";

describe("visualizeDiffFragment", () => {
  it("показывает пустоту и невидимые пробелы", () => {
    expect(visualizeDiffFragment(null)).toContain("ws-empty");
    expect(visualizeDiffFragment("")).toContain("∅");
    expect(visualizeDiffFragment(" ")).toContain("ws-sp");
    expect(visualizeDiffFragment("\u00A0")).toContain("ws-nbsp");
    expect(visualizeDiffFragment("а<б")).toContain("а&lt;б");
  });

  it("рисует стрелку между фрагментами", () => {
    const html = formatDiffHtml("а", "б");
    expect(html).toContain("→");
    expect(html).toContain("<b>");
  });
});

describe("isWhitespaceOnlyFragment", () => {
  it("считает пробелы пустым фрагментом, буквы — нет", () => {
    expect(isWhitespaceOnlyFragment(null)).toBe(true);
    expect(isWhitespaceOnlyFragment(" \u00A0\n")).toBe(true);
    expect(isWhitespaceOnlyFragment("а")).toBe(false);
  });
});
