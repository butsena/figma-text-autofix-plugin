import { describe, expect, it } from "vitest";
import { fixesFor } from "../test/helpers";
import { buildGeneralTypographyRules } from "../rules/typography/general-typography-rules";
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
        ruleId: "cian-095-nbsp-и",
        from: 10,
        to: 11,
        before: " ",
        after: "\u00a0",
      },
      "квартира и дом",
    );
    expect(html).toContain("reportCtxWord");
    expect(html).toContain("и");
    expect(html).toContain("дом");
    expect(html).toContain("·");
    expect(html).toContain("□");
  });

  it("показывает число и единицу для NBSP перед ₽", () => {
    const sourceText = "от 100 000 ₽";
    const [fix] = fixesFor(sourceText, buildGeneralTypographyRules()).filter(
      (f) => f.ruleId === "cian-110-nbsp-number-unit",
    );
    expect(fix).toBeDefined();
    const html = formatFixDiffHtml(fix!, sourceText);
    expect(html).toContain("reportCtxWord");
    expect(html).toContain("₽");
    expect(html).toContain("000");
    expect(html).toContain("·");
    expect(html).toContain("□");
    expect(html).not.toMatch(/→\s*<b><span class="ws-mark ws-nbsp">□<\/span><\/b>\s*$/);
  });

  it("показывает число и млн для NBSP перед сокращением", () => {
    const sourceText = "от 5 млн";
    const [fix] = fixesFor(sourceText, buildGeneralTypographyRules()).filter(
      (f) => f.ruleId === "cian-110-nbsp-number-unit",
    );
    const html = formatFixDiffHtml(fix!, sourceText);
    expect(html).toContain("5");
    expect(html).toContain("млн");
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
