import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../test/helpers";
import { getAutofixRules } from "./autofix-rules";
import {
  buildYoHomographRules,
  buildYoHomographRulesFromPairs,
  parseYoHomographPairs,
} from "./yo-homograph-rules";

const rules = buildYoHomographRules();
const allRules = getAutofixRules();

describe("parseYoHomographPairs", () => {
  it("парсит пары из текста", () => {
    expect(parseYoHomographPairs("все всё\n# коммент")).toEqual([{ eForm: "все", yoForm: "всё" }]);
  });
});

describe("buildYoHomographRules", () => {
  it("не создаёт правил для пустого словаря", () => {
    expect(buildYoHomographRulesFromPairs([])).toEqual([]);
    expect(rules).toEqual([]);
  });

  it("не обрабатывает все — это группа choice", () => {
    expect(fixesFor("проверьте все варианты", rules)).toHaveLength(0);
  });

  it("не обрабатывает ищите — это группа choice", () => {
    expect(fixesFor("ищите подходящий вариант", rules)).toHaveLength(0);
  });

  it("не применяет все автоматически через общий набор правил", () => {
    const out = applyAllRules("проверьте все варианты", allRules);
    expect(out).toContain("все");
    expect(out).not.toContain("всё");
  });
});
