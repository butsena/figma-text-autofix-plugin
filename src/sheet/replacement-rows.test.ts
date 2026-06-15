import { describe, expect, it } from "vitest";
import { applyAllRules } from "../test/helpers";
import {
  buildRulesFromMergedRows,
  mergeSheetReplacementRows,
  parseSheetReplacementRows,
  rowsToAutofixRules,
} from "./replacement-rows";

describe("parseSheetReplacementRows", () => {
  it("парсит CSV с заголовками", () => {
    const csv = `исходные варианты,верный текст,пояснение
"foo, FOO",bar,тест`;
    const rows = parseSheetReplacementRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].variants).toEqual(["foo", "FOO"]);
    expect(rows[0].replace).toBe("bar");
    expect(rows[0].message).toBe("тест");
  });

  it("пропускает отключённые строки", () => {
    const csv = `variants,replace,enabled
baz,qux,no`;
    expect(parseSheetReplacementRows(csv)).toHaveLength(0);
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
});

describe("mergeSheetReplacementRows", () => {
  it("remote перекрывает bundled по вариантам", () => {
    const bundled = [{ variants: ["foo"], replace: "a", message: "", category: "", priority: 1 }];
    const remote = [{ variants: ["foo"], replace: "b", message: "", category: "", priority: 1 }];
    const { rows, remoteCount, bundledOnlyCount } = mergeSheetReplacementRows(bundled, remote);
    expect(remoteCount).toBe(1);
    expect(bundledOnlyCount).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].replace).toBe("b");
  });

  it("bundled-only остаётся, если варианта нет в remote", () => {
    const bundled = [
      { variants: ["foo"], replace: "a", message: "", category: "", priority: 1 },
      { variants: ["bar"], replace: "c", message: "", category: "", priority: 1 },
    ];
    const remote = [{ variants: ["foo"], replace: "b", message: "", category: "", priority: 1 }];
    const { rows, bundledOnlyCount } = mergeSheetReplacementRows(bundled, remote);
    expect(bundledOnlyCount).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.variants.includes("bar"))?.replace).toBe("c");
  });
});

describe("buildRulesFromMergedRows", () => {
  it("собирает правила и статистику", () => {
    const { rules, stats } = buildRulesFromMergedRows(
      [{ variants: ["old"], replace: "new", message: "", category: "", priority: 1 }],
      [],
    );
    expect(rules).toHaveLength(1);
    expect(stats.totalCount).toBe(1);
    expect(stats.bundledOnlyCount).toBe(1);
    expect(applyAllRules("это old текст", rules)).toBe("это new текст");
  });
});
