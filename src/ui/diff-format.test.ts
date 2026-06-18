import { describe, expect, it } from "vitest";
import { fixesFor } from "../test/helpers";
import { buildSingleSentenceRemovePeriodRules } from "../rules/typography/single-sentence-remove-period-rules";
import { formatFixDiffHtml } from "./diff-format";

describe("formatFixDiffHtml", () => {
  it("показывает контекстное слово при снятии точки в одном предложении", () => {
    const [fix] = fixesFor("Заполните профиль.", buildSingleSentenceRemovePeriodRules());
    const html = formatFixDiffHtml(fix, "Заполните профиль.");
    expect(html).toContain("профиль.");
    expect(html).toContain("профиль</span></b>");
    expect(html).not.toContain("∅");
  });

  it("показывает контекстное слово для неявной точки", () => {
    const sourceText = "по запросу Главное";
    const html = formatFixDiffHtml(
      {
        ruleId: "cian-139a-implicit-sentence-period",
        from: 10,
        to: 10,
        before: "",
        after: ".",
      },
      sourceText,
    );
    expect(html).toContain("запросу");
    expect(html).toContain("запросу.");
    expect(html).not.toContain("∅");
  });

  it("показывает контекст для NBSP после служебного слова", () => {
    const html = formatFixDiffHtml(
      {
        ruleId: "cian-095-nbsp-after-short-words-strict",
        from: 10,
        to: 11,
        before: " ",
        after: "\u00a0",
      },
      "квартира и дом",
    );
    expect(html).toContain("reportCtxWord");
    expect(html).toContain("·");
    expect(html).toContain("□");
  });

  it("показывает обычный diff для прочих правил", () => {
    const html = formatFixDiffHtml(
      {
        ruleId: "cian-001-cian-brand-uppercase",
        before: "ЦИАН",
        after: "Циан",
      },
      "на ЦИАН",
    );
    expect(html).toContain("ЦИАН");
    expect(html).toContain("Циан");
  });
});
