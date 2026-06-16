import { describe, it } from "vitest";
import { getAutofixRules } from "../rules/autofix-rules";

describe("dump rule messages", () => {
  it("prints table", () => {
    const rules = getAutofixRules();
    const byMessage = new Map<string, { category: string; ids: string[]; example?: string }>();

    for (const r of rules) {
      const key = `${r.category}\0${r.message}`;
      const cur = byMessage.get(key) ?? { category: r.category, ids: [] };
      cur.ids.push(r.id);
      byMessage.set(key, cur);
    }

    const rows = [...byMessage.entries()]
      .map(([key, v]) => {
        const message = key.split("\0")[1];
        return {
          category: v.category,
          message,
          rules: v.ids.length,
          exampleId: v.ids[0],
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.message.localeCompare(b.message));

    console.log("TOTAL_RULES", rules.length);
    console.log("UNIQUE_MESSAGES", rows.length);
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }
  });
});
