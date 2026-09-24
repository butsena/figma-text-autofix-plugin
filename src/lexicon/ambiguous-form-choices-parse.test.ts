import { describe, expect, it } from "vitest";
import { parseAmbiguousFormChoices } from "./ambiguous-form-choices-parse";

describe("parseAmbiguousFormChoices", () => {
  it("парсит строку форма1 - форма2 - подсказка", () => {
    const [choice] = parseAmbiguousFormChoices("ищите - ищете - что делаете? | пример");
    expect(choice).toMatchObject({
      id: "cian-choice-ищите-ищете",
      options: ["ищите", "ищете"],
      message: "Выберите форму глагола",
    });
    expect(choice?.hintHtml).toContain("что делаете?");
    expect(choice?.hintHtml).toContain("пример");
  });

  it("читает id из комментария", () => {
    const raw = `
# id: cian-choice-vse-vsyo
все - всё - по редполитике
`;
    const [choice] = parseAmbiguousFormChoices(raw);
    expect(choice?.id).toBe("cian-choice-vse-vsyo");
    expect(choice?.message).toBe("Выберите букву");
    expect(choice?.hint).toBe("по редполитике");
  });

  it("формирует список подсказок через ; и |", () => {
    const raw =
      "ищите - ищете - что делаете? | ищете квартиру; что делайте? | ищите квартиру";
    const [choice] = parseAmbiguousFormChoices(raw);
    expect(choice?.hintHtml).toContain("reportHintList");
    expect(choice?.hintHtml).toContain("reportHintSep");
    expect(choice?.hintHtml).toContain("ищете квартиру");
    expect(choice?.hintHtml).toContain("ищите квартиру");
  });

  it("игнорирует комментарии и пустые строки", () => {
    const raw = `
# комментарий
# id: cian-choice-ishchite-ishchete

ищите - ищете - подсказка
`;
    expect(parseAmbiguousFormChoices(raw)).toHaveLength(1);
  });

  it("бросает на неверной строке", () => {
    expect(() => parseAmbiguousFormChoices("без разделителей")).toThrow(/Неверная строка/);
  });

  it("парсит пишите/пишете и ждите/ждёте с hintHtml", () => {
    const choices = parseAmbiguousFormChoices(`
# id: cian-choice-pishite-pishete
пишите - пишете - что делайте? | пишите письма; что делаете? | пишете правильно
# id: cian-choice-zhdite-zhdyote
ждите - ждёте - что делайте? | ждите; что делаете? | ждёте
`);
    expect(choices).toHaveLength(2);
    expect(choices[0]).toMatchObject({
      id: "cian-choice-pishite-pishete",
      options: ["пишите", "пишете"],
      allowSkip: false,
    });
    expect(choices[0]?.hintHtml).toContain("пишите письма");
    expect(choices[1]).toMatchObject({
      id: "cian-choice-zhdite-zhdyote",
      options: ["ждите", "ждёте"],
    });
    expect(choices[1]?.hintHtml).toContain("ждёте");
  });

  it("парсит напишите/напишете с hintHtml", () => {
    const [choice] = parseAmbiguousFormChoices(`
# id: cian-choice-napishite-napishete
напишите - напишете - что сделайте? | напишите мне срочно!; что сделаете? | завтра вы все напишете диктант!
`);
    expect(choice).toMatchObject({
      id: "cian-choice-napishite-napishete",
      options: ["напишите", "напишете"],
    });
    expect(choice?.hintHtml).toContain("напишите мне срочно!");
    expect(choice?.hintHtml).toContain("завтра вы все напишете диктант!");
  });
});
