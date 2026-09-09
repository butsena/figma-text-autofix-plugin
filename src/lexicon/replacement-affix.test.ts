import { describe, expect, it } from "vitest";
import { affixReplacement, affixStemPattern, longestStemMatch, transferEnding } from "./replacement-affix";

describe("transferEnding", () => {
  it("переносит окончание на новую основу", () => {
    expect(transferEnding("риэлторам", "риэлтор", "риелтор")).toBe("риелторам");
    expect(transferEnding("Риэлторов", "риэлтор", "риелтор")).toBe("Риелторов");
    expect(transferEnding("РИЭЛТОР", "риэлтор", "риелтор")).toBe("РИЕЛТОР");
  });

  it("работает для join-основ с дефисом", () => {
    expect(transferEnding("промо-кодов", "промо-код", "промокод")).toBe("промокодов");
    expect(transferEnding("Промо кода", "промо код", "промокод")).toBe("Промокода");
  });
});

describe("longestStemMatch", () => {
  it("выбирает самую длинную основу", () => {
    expect(longestStemMatch("кешбека", ["кэшбэк", "кешбек"])).toBe("кешбек");
    expect(longestStemMatch("кэшбэком", ["кэшбэк", "кешбек"])).toBe("кэшбэк");
  });
});

describe("affixStemPattern + affixReplacement", () => {
  it("заменяет словоформы с переносом окончания", () => {
    const stems = ["риэлтор"];
    const pattern = affixStemPattern(stems)!;
    const repl = affixReplacement("риелтор", stems);
    const m = pattern.exec("услуги риэлторам тут");
    expect(m).not.toBeNull();
    expect(repl(m![0], m![1], m![2], m![3])).toBe(`${m![1]}риелторам`);
  });

  it("нормализует кэшбэк/кешбек", () => {
    const stems = ["кэшбэк", "кешбек"];
    const pattern = affixStemPattern(stems)!;
    const repl = affixReplacement("кешбэк", stems);
    pattern.lastIndex = 0;
    const m = pattern.exec("Кешбека");
    expect(m).not.toBeNull();
    expect(repl(m![0], m![1], m![2], m![3])).toBe(`${m![1]}Кешбэка`);
  });

  it("join-основа с ASCII-дефисом ловит типографские дефисы и NBSP", () => {
    const stems = ["он-лайн", "он лайн"];
    const pattern = affixStemPattern(stems)!;
    const repl = affixReplacement("онлайн", stems);
    for (const dash of ["-", "\u2010", "\u2011", "\u2013", "\u2014"]) {
      pattern.lastIndex = 0;
      const text = `он${dash}лайн`;
      const m = pattern.exec(text);
      expect(m, text).not.toBeNull();
      expect(repl(m![0], m![1], m![2], m![3])).toBe(`${m![1]}онлайн`);
    }
    pattern.lastIndex = 0;
    const nbsp = `он\u00A0лайн`;
    const m = pattern.exec(nbsp);
    expect(m).not.toBeNull();
    expect(repl(m![0], m![1], m![2], m![3])).toBe(`${m![1]}онлайн`);
  });

  it("латинское online — целое слово, не подстрока", () => {
    const stems = ["он-лайн", "он лайн", "online"];
    const pattern = affixStemPattern(stems)!;
    const repl = affixReplacement("онлайн", stems);

    pattern.lastIndex = 0;
    const hit = pattern.exec("смотрите online квартиру");
    expect(hit).not.toBeNull();
    expect(repl(hit![0], hit![1], hit![2], hit![3])).toBe(`${hit![1]}онлайн`);

    pattern.lastIndex = 0;
    expect(pattern.exec("onlinebooking")).toBeNull();
  });
});
