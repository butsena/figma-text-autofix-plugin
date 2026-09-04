import { describe, expect, it } from "vitest";
import { applyAllRules } from "../test/helpers";
import { parseReplacementRows, rowsToAutofixRules } from "./replacement-rows";

describe("parseReplacementRows", () => {
  it("парсит CSV с заголовками", () => {
    const csv = `исходные варианты,верный текст,пояснение
"foo, FOO",bar,тест`;
    const rows = parseReplacementRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].variants).toEqual(["foo", "FOO"]);
    expect(rows[0].replace).toBe("bar");
    expect(rows[0].message).toBe("тест");
  });

  it("пропускает отключённые строки", () => {
    const csv = `variants,replace,enabled
baz,qux,no`;
    expect(parseReplacementRows(csv)).toHaveLength(0);
  });
});

describe("rowsToAutofixRules", () => {
  it("заменяет целое слово", () => {
    const rules = rowsToAutofixRules(
      [{ variants: ["приобрести"], replace: "купить", message: "", category: "test", priority: 70 }],
      "test",
    );
    expect(applyAllRules("хотим приобрести квартиру", rules)).toBe("хотим купить квартиру");
  });

  it("собирает правила из строк", () => {
    const rules = rowsToAutofixRules(
      [{ variants: ["old"], replace: "new", message: "", category: "", priority: 1 }],
      "sheet-text",
    );
    expect(rules).toHaveLength(1);
    expect(applyAllRules("это old текст", rules)).toBe("это new текст");
  });
});
