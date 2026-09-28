import { describe, expect, it } from "vitest";
import { fixesFor } from "../test/helpers";
import { buildGeneralTypographyRules } from "../rules/typography/general-typography-rules";
import { buildSentenceCapitalizationRules } from "../rules/typography/sentence-capitalization-rules";
import { buildSentenceTerminalPeriodRules } from "../rules/typography/sentence-terminal-period-rules";
import { buildSingleSentenceRemovePeriodRules } from "../rules/typography/single-sentence-remove-period-rules";
import { buildFormalVerbRules } from "../rules/cian/formal-verb-rules";
import { formatAnchorContextHtml, formatFixDiffHtml } from "./diff-format";

describe("formatFixDiffHtml", () => {
  it("показывает контекстное слово при снятии точки в одном предложении", () => {
    const [fix] = fixesFor("Заполните профиль.", buildSingleSentenceRemovePeriodRules());
    const html = formatFixDiffHtml(fix, "Заполните профиль.");
    expect(html).toContain("профиль.");
    expect(html).toContain("профиль</span></b>");
    expect(html).not.toContain("∅");
  });

  it("показывает целое слово при постановке точки в конце предложения", () => {
    const sourceText = "Первое. Второе";
    const [fix] = fixesFor(sourceText, buildSentenceTerminalPeriodRules());
    expect(fix).toBeDefined();
    const html = formatFixDiffHtml(fix!, sourceText);
    expect(html).toContain(">Второе</span>");
    expect(html).toContain(">Второе.</span>");
  });

  it("показывает целое слово, если правка сузилась до последней буквы + точка", () => {
    const html = formatFixDiffHtml(
      {
        ruleId: "cian-139-sentence-terminal-period",
        from: 6,
        to: 7,
        before: "е",
        after: "е.",
      },
      "решение",
    );
    expect(html).toContain(">решение</span>");
    expect(html).toContain(">решение.</span>");
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

  it("показывает целое слово с выделенной первой буквой при капитализации", () => {
    const sourceText = "сохраните файл";
    const [fix] = fixesFor(sourceText, buildSentenceCapitalizationRules());
    expect(fix).toMatchObject({ before: "с", after: "С", from: 0, to: 1 });
    const html = formatFixDiffHtml(fix!, sourceText);
    expect(html).toContain('<span class="reportCtxWord"><b>с</b>охраните</span>');
    expect(html).toContain('<span class="reportCtxWord"><b>С</b>охраните</span>');
    expect(html).not.toMatch(/^с <span[^>]*>→<\/span> <b>С<\/b>$/);
  });

  it("не расширяет суффиксный дифф до целого слова", () => {
    const sourceText = "Заполни твой профиль";
    const fix = fixesFor(sourceText, buildFormalVerbRules()).find(
      (f) => f.before === "и" && f.after === "ите",
    );
    expect(fix).toBeDefined();
    const html = formatFixDiffHtml(fix!, sourceText);
    expect(html).toContain("и");
    expect(html).toContain("ите");
    expect(html).not.toContain("Заполни");
    expect(html).not.toContain("Заполните");
  });

  it("показывает окно из соседних слов и не режет короткий слой", () => {
    const sourceText =
      "один два три четыре пять шесть семь восемь девять десять";
    const html = formatFixDiffHtml(
      {
        ruleId: "cian-001-cian-brand-uppercase",
        from: 13,
        to: 19,
        before: "четыре",
        after: "Четыре",
      },
      sourceText,
    );
    expect(html).toContain("один");
    expect(html).toContain("три");
    expect(html).toContain("<b>Четыре</b>");
    expect(html).toContain("пять");
    expect(html).toContain("восемь");
    expect(html).not.toContain("девять");
    expect(html).toContain("reportCtxEllipsis");

    const short = formatAnchorContextHtml("напишите мне", 0, 8);
    expect(short).toContain("<b>напишите</b>");
    expect(short).toContain("мне");
    expect(short).not.toContain("reportCtxEllipsis");
  });

  it("в окне видны NBSP и перевод строки", () => {
    const sourceText = "слово\u00a0рядом\nдальше ещё текст тут лишний хвост";
    const html = formatAnchorContextHtml(sourceText, 6, 11);
    expect(html).toContain("ws-nbsp");
    expect(html).toContain("ws-nl");
    expect(html).toContain("<b>рядом</b>");
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
