import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyAllRules } from "../test/helpers";
import { parseReplacementRows, rowsToAutofixRules } from "./replacement-rows";

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../data/text-replacements.csv");

function downPaymentRules() {
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseReplacementRows(raw).filter(
    (row) => row.kind === "phrase" && /взнос/i.test(row.replace),
  );
  return rowsToAutofixRules(rows, "down-payment-test");
}

describe("первоначальный взнос → первый взнос (лексикон)", () => {
  const rules = downPaymentRules();

  it("собирается в одно правило на фразу", () => {
    expect(rules).toHaveLength(1);
  });

  it("покрывает единственное и множественное число", () => {
    const pairs: Array<[string, string]> = [
      ["нужен первоначальный взнос", "нужен первый взнос"],
      ["размер первоначального взноса", "размер первого взноса"],
      ["к первоначальному взносу", "к первому взносу"],
      ["с первоначальным взносом", "с первым взносом"],
      ["о первоначальном взносе", "о первом взносе"],
      ["внесите первоначальный взнос", "внесите первый взнос"],
      ["несколько первоначальных взносов", "несколько первых взносов"],
      ["первоначальные взносы по ипотеке", "первые взносы по ипотеке"],
      ["к первоначальным взносам", "к первым взносам"],
      ["первоначальными взносами", "первыми взносами"],
      ["в первоначальных взносах", "в первых взносах"],
      ["Первоначальный взнос", "Первый взнос"],
    ];

    for (const [input, expected] of pairs) {
      expect(applyAllRules(input, rules), input).toBe(expected);
    }
  });
});
