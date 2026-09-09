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
});
