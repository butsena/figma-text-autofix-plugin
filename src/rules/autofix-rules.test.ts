import { describe, expect, it } from "vitest";
import { getAutofixRules, invalidateAutofixRulesCache } from "./autofix-rules";

describe("getAutofixRules", () => {
  it("возвращает непустой список правил", () => {
    const rules = getAutofixRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.id && r.pattern)).toBe(true);
  });

  it("кэширует результат между вызовами", () => {
    const first = getAutofixRules();
    const second = getAutofixRules();
    expect(first).toBe(second);
  });

  it("invalidateAutofixRulesCache пересобирает список", () => {
    const cached = getAutofixRules();
    invalidateAutofixRulesCache();
    const rebuilt = getAutofixRules();
    expect(rebuilt).not.toBe(cached);
    expect(rebuilt.length).toBe(cached.length);
  });
});
