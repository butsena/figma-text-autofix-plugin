import { describe, expect, it } from "vitest";
import { getAutofixRules } from "../rules/autofix-rules";
import { MSG_TYPO_EMDASH, MSG_TYPO_NBSP_SUMMARY } from "../rules/rule-messages";
import { autoFixesFor } from "../test/helpers";
import {
  countNbspGlues,
  formatNbspSentenceHtml,
  isNbspGlueFix,
  renderNbspGlueSummaryHtml,
} from "./nbsp-glue-summary";

const nbsp = "\u00a0";
const allRules = () => getAutofixRules();

describe("isNbspGlueFix", () => {
  it("берёт обычный пробел → NBSP, вставку NBSP и узкий NBSP", () => {
    expect(isNbspGlueFix({ before: " ", after: nbsp })).toBe(true);
    expect(isNbspGlueFix({ before: "", after: nbsp })).toBe(true);
    expect(isNbspGlueFix({ before: " ", after: "\u202f" })).toBe(true);
  });

  it("не берёт схлопывание, перенос и замену на тире", () => {
    expect(isNbspGlueFix({ before: "  ", after: " " })).toBe(false);
    expect(isNbspGlueFix({ before: "  ", after: nbsp })).toBe(false);
    expect(isNbspGlueFix({ before: `${nbsp}${nbsp}`, after: nbsp })).toBe(false);
    expect(isNbspGlueFix({ before: "\n", after: nbsp })).toBe(false);
    expect(isNbspGlueFix({ before: " - ", after: `${nbsp}— ` })).toBe(false);
  });
});

describe("formatNbspSentenceHtml", () => {
  it("обычный пробел оставляет пробелом, NBSP рисует □", () => {
    const html = formatNbspSentenceHtml(`Циан и${nbsp}дом`);
    expect(html).toContain("Циан и");
    expect(html).toContain("ws-nbsp");
    expect(html).toContain("□");
    expect(html).not.toContain("ws-sp");
  });
});

describe("renderNbspGlueSummaryHtml", () => {
  it("склеивает несколько NBSP в один текст слоя", () => {
    const html = renderNbspGlueSummaryHtml([
      {
        from: 0,
        to: 4,
        before: "ЦИАН",
        after: "Циан",
        sourceText: "ЦИАН и дом",
      },
      {
        from: 6,
        to: 7,
        before: " ",
        after: nbsp,
        sourceText: "ЦИАН и дом",
      },
    ]);
    expect(html).toContain(MSG_TYPO_NBSP_SUMMARY);
    expect(html).toContain("1 склейка в этом слое");
    expect(html).toContain("Циан и");
    expect(html).toContain("ws-nbsp");
    expect(html).not.toContain("ЦИАН");
  });

  it("на «ЦИАН и дом, но квартира в центре» три склейки и бренд в тексте", () => {
    const sourceText = "ЦИАН и дом, но квартира в центре";
    const fixes = autoFixesFor(sourceText, allRules());
    expect(countNbspGlues(fixes)).toBe(3);
    expect(fixes.some((f) => f.before === "ЦИАН" && f.after === "Циан")).toBe(true);

    const html = renderNbspGlueSummaryHtml(
      fixes.map((f) => ({
        from: f.from,
        to: f.to,
        before: f.before,
        after: f.after,
        sourceText,
      })),
    );
    expect(html).toContain(MSG_TYPO_NBSP_SUMMARY);
    expect(html).toContain("3 склейки в этом слое");
    expect(html).toContain("Циан и");
    expect(html).toContain("квартира");
    expect((html.match(/ws-nbsp/g) ?? []).length).toBe(3);
    expect(html).not.toContain("ЦИАН");
  });

  it("склоняет «склейки» и «склеек»", () => {
    const glue = (from: number) => ({
      from,
      to: from + 1,
      before: " ",
      after: nbsp,
      sourceText: "a b c d e f",
    });
    expect(renderNbspGlueSummaryHtml([glue(1), glue(3)])).toContain("2 склейки в этом слое");
    expect(
      renderNbspGlueSummaryHtml([glue(1), glue(3), glue(5), glue(7), glue(9)]),
    ).toContain("5 склеек в этом слое");
  });
});

describe("autoFixes: тире не считается склейкой", () => {
  it("«да - нет» даёт длинное тире; space после «да» — отдельная склейка", () => {
    const sourceText = "да - нет";
    const fixes = autoFixesFor(sourceText, allRules());
    expect(fixes.some((f) => f.message === MSG_TYPO_EMDASH)).toBe(true);
    expect(countNbspGlues(fixes)).toBe(1);
    expect(fixes.filter((f) => !isNbspGlueFix(f)).some((f) => f.message === MSG_TYPO_EMDASH)).toBe(
      true,
    );
  });
});
