import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../test/helpers";
import { getAutofixRules } from "./autofix-rules";
import { buildYoHomographRules, parseYoHomographPairs } from "./yo-homograph-rules";

const rules = buildYoHomographRules();
const allRules = getAutofixRules();

describe("parseYoHomographPairs", () => {
  it("парсит пары из текста", () => {
    expect(parseYoHomographPairs("все всё\n# коммент")).toEqual([{ eForm: "все", yoForm: "всё" }]);
  });
});

describe("buildYoHomographRules", () => {
  it("предлагает всё вместо все", () => {
    const [fix] = fixesFor("проверьте все варианты", rules);
    expect(fix).toMatchObject({
      applyPolicy: "confirm",
      before: "все",
      after: "всё",
      message: "Проверьте: «все» или «всё»?",
    });
  });

  it("не трогает уже написанное всё", () => {
    expect(fixesFor("всё готово", rules)).toHaveLength(0);
  });

  it("не применяется автоматически", () => {
    const out = applyAllRules("проверьте все варианты", allRules);
    expect(out).toContain("все");
    expect(out).not.toContain("всё");
  });

  it("сохраняет регистр", () => {
    const [fix] = fixesFor("Все варианты", rules);
    expect(fix).toMatchObject({ before: "Все", after: "Всё" });
  });
});
