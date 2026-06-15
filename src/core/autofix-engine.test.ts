import { describe, expect, it } from "vitest";
import { applyTextFixes, checkTextForAutofixes, narrowReplacementRange, type AutofixRule } from "./autofix-engine";
import { rule } from "./rule-def";

const swapRule: AutofixRule = rule({
  id: "test-swap",
  category: "test",
  pattern: /foo/g,
  replacement: "bar",
  message: "test",
  priority: 1,
});

const groupedRule: AutofixRule = rule({
  id: "test-group",
  category: "test",
  pattern: /(a)(b)/g,
  replacement: "$2$1",
  message: "test",
  priority: 1,
});

const fnRule: AutofixRule = rule({
  id: "test-fn",
  category: "test",
  pattern: /(^| )(\w+)/gu,
  replacement: (_match, prefix, word) => `${prefix}[${word}]`,
  message: "test",
  priority: 1,
});

describe("checkTextForAutofixes", () => {
  it("находит простую строковую замену", () => {
    const { fixes } = checkTextForAutofixes("foo baz foo", [swapRule]);
    expect(fixes).toHaveLength(2);
    expect(fixes[0]).toMatchObject({ before: "foo", after: "bar" });
  });

  it("подставляет $1, $2 в строковый replacement", () => {
    const { fixes } = checkTextForAutofixes("ab", [groupedRule]);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({ before: "ab", after: "ba" });
  });

  it("передаёт группы в function replacement без повторного exec с начала", () => {
    const { fixes } = checkTextForAutofixes("one two", [fnRule]);
    expect(fixes.map((f) => f.after)).toEqual(["[one]", "[two]"]);
    expect(applyTextFixes("one two", fixes)).toBe("[one] [two]");
  });
});

describe("narrowReplacementRange", () => {
  it("отделяет неизменный пробел перед словом", () => {
    expect(narrowReplacementRange(1, " SMS", " смс")).toEqual({
      from: 2,
      to: 5,
      before: "SMS",
      after: "смс",
    });
  });

  it("не дробит замену при смене регистра в слове", () => {
    expect(narrowReplacementRange(5, "Вас", "вас")).toEqual({
      from: 5,
      to: 8,
      before: "Вас",
      after: "вас",
    });
  });

  it("отделяет неизменный пробел после служебного слова", () => {
    const nbsp = "\u00a0";
    expect(narrowReplacementRange(3, " в ", ` в${nbsp}`)).toEqual({
      from: 5,
      to: 6,
      before: " ",
      after: nbsp,
    });
  });
});

describe("applyTextFixes", () => {
  it("применяет правки с конца, чтобы индексы не съезжали", () => {
    const fixes = [
      { from: 0, to: 3, before: "foo", after: "FOO", ruleId: "", category: "", message: "", priority: 0 },
      { from: 4, to: 7, before: "bar", after: "BAR", ruleId: "", category: "", message: "", priority: 0 },
    ];
    expect(applyTextFixes("foo bar", fixes)).toBe("FOO BAR");
  });

  it("пропускает устаревшую правку, если before уже не совпадает", () => {
    const fixes = [
      { from: 0, to: 3, before: "foo", after: "baz", ruleId: "", category: "", message: "", priority: 0 },
    ];
    expect(applyTextFixes("bar", fixes)).toBe("bar");
  });
});
