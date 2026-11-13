import { describe, expect, it } from "vitest";
import {
  applyOutsideContext,
  formatAnchorContextHtml,
  formatContextualWhitespaceDiff,
  isContextSpace,
} from "./diff-context-window";

const arrow = ' <span style="color:#888;font-weight:400">→</span> ';

describe("isContextSpace", () => {
  it("считает обычный, неразрывный и узкий пробел, таб и перевод строки", () => {
    const sample = "a \n\t\u00a0\u202fb";
    expect(isContextSpace(sample, 1)).toBe(true);
    expect(isContextSpace(sample, 2)).toBe(true);
    expect(isContextSpace(sample, 3)).toBe(true);
    expect(isContextSpace(sample, 4)).toBe(true);
    expect(isContextSpace(sample, 5)).toBe(true);
    expect(isContextSpace(sample, 0)).toBe(false);
  });
});

describe("formatAnchorContextHtml", () => {
  it("короткий слой показывает якорь жирным без многоточия", () => {
    const html = formatAnchorContextHtml("напишите мне", 0, 8);
    expect(html).toContain("<b>");
    expect(html).toContain("напишите");
    expect(html).toContain("мне");
    expect(html).not.toContain("reportCtxEllipsis");
  });

  it("на длинном слое обрезает края многоточием по словам", () => {
    const source =
      "один два три четыре пять шесть семь восемь девять десять Циан дальше текст ещё";
    const from = source.indexOf("Циан");
    const html = formatAnchorContextHtml(source, from, from + 4);
    expect(html).toContain('class="reportCtxEllipsis"');
    expect(html).toContain("<b>");
    expect(html).toContain("Циан");
    expect(html).not.toContain("один");
  });

  it("для пробельного якоря не раздувает границы в соседние слова", () => {
    const source = "Циан и дом";
    const from = source.indexOf(" ");
    const html = formatAnchorContextHtml(source, from, from + 1);
    expect(html).toContain("<b>");
    expect(html).toContain("Циан");
    expect(html).toContain("и");
  });
});

describe("applyOutsideContext", () => {
  it("без стрелки просто обрамляет diff словами вокруг", () => {
    const source = "семь восемь девять десять Циан дальше";
    const from = source.indexOf("Циан");
    const out = applyOutsideContext("<b>Циан</b>", source, from, from + 4);
    expect(out).toContain("девять");
    expect(out).toContain("<b>Циан</b>");
    expect(out).toContain("дальше");
    expect(out.indexOf("девять")).toBeLessThan(out.indexOf("<b>Циан</b>"));
  });

  it("со стрелкой дублирует левый контекст по обе стороны стрелки", () => {
    const source = "семь восемь девять десять ЦИАН дальше";
    const from = source.indexOf("ЦИАН");
    const diff = `ЦИАН${arrow}<b>Циан</b>`;
    const out = applyOutsideContext(diff, source, from, from + 4);
    expect(out).toContain("девять");
    expect(out.indexOf("девять")).toBeLessThan(out.indexOf("ЦИАН"));
    expect(out).toContain(arrow);
    const afterArrow = out.slice(out.indexOf(arrow) + arrow.length);
    expect(afterArrow).toContain("девять");
    expect(afterArrow).toContain("<b>Циан</b>");
  });

  it("на пустом окружении возвращает исходный diff", () => {
    expect(applyOutsideContext("x → y", "x", 0, 1)).toBe("x → y");
  });
});

describe("formatContextualWhitespaceDiff", () => {
  it("строит контекстный diff пробела между словами", () => {
    const source = "квартира и дом";
    const from = source.indexOf(" ");
    const html = formatContextualWhitespaceDiff(source, from, from + 1, " ", "\u00a0");
    expect(html).not.toBeNull();
    expect(html!).toContain("квартира");
    expect(html!).toContain("дом");
    expect(html!).toContain(arrow.trim());
    expect(html!).toContain("<b>");
  });

  it("возвращает null, если рядом нет слов", () => {
    expect(formatContextualWhitespaceDiff("   ", 1, 2, " ", "\u00a0")).toBeNull();
  });

  it("ставит многоточие, когда слов слева/справа больше лимита", () => {
    const source = "а б в г д е ж з пробел хвост1 хвост2 хвост3 хвост4 хвост5";
    const from = source.indexOf("пробел") - 1;
    const html = formatContextualWhitespaceDiff(source, from, from + 1, " ", "\u00a0");
    expect(html).toContain('class="reportCtxEllipsis"');
  });
});
