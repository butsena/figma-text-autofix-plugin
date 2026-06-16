import { describe, expect, it } from "vitest";
import { getAutofixRules } from "../autofix-rules";
import { checkTextForAutofixes } from "../../core/autofix-engine";

const TEXT =
  "Любого слона можно купить онлайн — цену скину вам в смс по запросу. Заполни твой профиль";

describe("full sentence fixes", () => {
  it("находит Заполни и твой", () => {
    const { fixes } = checkTextForAutofixes(TEXT, getAutofixRules());
    const summary = fixes.map((f) => ({
      before: f.before,
      after: f.after,
      from: f.from,
      to: f.to,
      ruleId: f.ruleId,
    }));
    console.log(JSON.stringify(summary, null, 2));
    expect(fixes.some((f) => f.before === "твой" && f.after === "ваш")).toBe(true);
    expect(
      fixes.some(
        (f) =>
          (f.before === "и" && f.after === "ите") ||
          (f.before === "Заполни" && f.after === "Заполните"),
      ),
    ).toBe(true);
  });
});
