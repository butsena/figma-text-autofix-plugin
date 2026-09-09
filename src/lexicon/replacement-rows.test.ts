import { describe, expect, it } from "vitest";
import { applyAllRules } from "../test/helpers";
import { parseFormsCell, parseReplacementRows, rowsToAutofixRules } from "./replacement-rows";

describe("parseFormsCell", () => {
  it("парсит пары с альтернативами", () => {
    expect(parseFormsCell("приобрёл|приобрел=купил; приобрела=купила")).toEqual([
      { variants: ["приобрёл", "приобрел"], replace: "купил" },
      { variants: ["приобрела"], replace: "купила" },
    ]);
  });
});

describe("parseReplacementRows", () => {
  it("парсит новый формат с типом", () => {
    const csv = `тип,найти,заменить,формы,пояснение
spell,риэлтор,риелтор,,тест
lemma,приобрести,купить,приобрела=купила,`;
    const rows = parseReplacementRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("spell");
    expect(rows[0].variants).toEqual(["риэлтор"]);
    expect(rows[0].message).toBe("тест");
    expect(rows[1].kind).toBe("lemma");
    expect(rows[1].forms).toEqual([{ variants: ["приобрела"], replace: "купила" }]);
  });

  it("парсит старый CSV без типа как exact", () => {
    const csv = `исходные варианты,верный текст,пояснение
"foo, FOO",bar,тест`;
    const rows = parseReplacementRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("exact");
    expect(rows[0].variants).toEqual(["foo", "FOO"]);
    expect(rows[0].replace).toBe("bar");
  });

  it("пропускает отключённые строки", () => {
    const csv = `variants,replace,enabled
baz,qux,no`;
    expect(parseReplacementRows(csv)).toHaveLength(0);
  });
});

describe("rowsToAutofixRules", () => {
  it("exact сохраняет регистр через capitalizeLike", () => {
    const rules = rowsToAutofixRules(
      [
        {
          kind: "exact",
          variants: ["далее"],
          replace: "дальше",
          forms: [],
          message: "",
          category: "test",
          priority: 70,
        },
      ],
      "test",
    );
    expect(applyAllRules("Далее по тексту", rules)).toBe("Дальше по тексту");
    expect(applyAllRules("ДАЛЕЕ", rules)).toBe("ДАЛЬШЕ");
  });

  it("spell переносит окончания", () => {
    const rules = rowsToAutofixRules(
      [
        {
          kind: "spell",
          variants: ["риэлтор"],
          replace: "риелтор",
          forms: [],
          message: "",
          category: "test",
          priority: 70,
        },
      ],
      "test",
    );
    expect(applyAllRules("услуги риэлторам", rules)).toBe("услуги риелторам");
    expect(applyAllRules("Риэлторов нет", rules)).toBe("Риелторов нет");
  });

  it("lemma подставляет разные формы", () => {
    const rules = rowsToAutofixRules(
      [
        {
          kind: "lemma",
          variants: ["приобрести"],
          replace: "купить",
          forms: [{ variants: ["приобрела"], replace: "купила" }],
          message: "",
          category: "test",
          priority: 70,
        },
      ],
      "test",
    );
    expect(applyAllRules("хотим приобрести", rules)).toBe("хотим купить");
    expect(applyAllRules("она Приобрела", rules)).toBe("она Купила");
  });

  it("собирает правила из строк", () => {
    const rules = rowsToAutofixRules(
      [
        {
          kind: "exact",
          variants: ["old"],
          replace: "new",
          forms: [],
          message: "",
          category: "",
          priority: 1,
        },
      ],
      "sheet-text",
    );
    expect(rules).toHaveLength(1);
    expect(applyAllRules("это old текст", rules)).toBe("это new текст");
  });
});
