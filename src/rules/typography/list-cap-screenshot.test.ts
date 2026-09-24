import { describe, expect, it } from "vitest";
import { applyAllRules, applyProposedFixes, fixesFor } from "../../test/helpers";
import { getAutofixRules } from "../autofix-rules";
import { buildSentenceCapitalizationRules } from "./sentence-capitalization-rules";

describe("screenshot list capitalization", () => {
  const capsOnly = buildSentenceCapitalizationRules();
  const all = getAutofixRules();
  const text =
    "1. показываем общее количество за каждый день в выбранный период\n2. пав картер мс";

  it("capitalizes both items with cap rules and full rule set", () => {
    expect(applyProposedFixes(text, capsOnly)).toContain("1. Показываем");
    expect(applyProposedFixes(text, capsOnly)).toContain("2. Пав");
    expect(applyProposedFixes(text, all)).toContain("1. Показываем");
    expect(applyProposedFixes(text, all)).toContain("2. Пав");
    expect(applyAllRules(text, all)).toContain("1. показываем");
    expect(applyAllRules(text, all)).toContain("2. пав");
  });

  it("сужает правку до одной буквы", () => {
    const caps = fixesFor(text, capsOnly).filter((f) =>
      f.ruleId.includes("numbered-list"),
    );
    expect(caps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ before: "п", after: "П" }),
      ]),
    );
    expect(caps.every((f) => f.before === "п" && f.after === "П")).toBe(true);
    expect(caps.length).toBe(2);
  });
});
