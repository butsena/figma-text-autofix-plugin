import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyAllRules } from "../test/helpers";
import { parseSheetReplacementRows, rowsToAutofixRules } from "./replacement-rows";

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../data/text-replacements.csv");

function acquireRules() {
  const raw = readFileSync(csvPath, "utf8");
  const rows = parseSheetReplacementRows(raw).filter((row) =>
    row.variants.some((v) => /приобр/i.test(v)),
  );
  return rowsToAutofixRules(rows, "acquire-test");
}

describe("приобрести → купить (лексикон)", () => {
  const rules = acquireRules();

  it("покрывает все основные грамматические формы", () => {
    const pairs: Array<[string, string]> = [
      ["хотим приобрести", "хотим купить"],
      ["Приобрети сейчас", "Купи сейчас"],
      ["приобретите квартиру", "купите квартиру"],
      ["он приобрёл", "он купил"],
      ["она приобрела", "она купила"],
      ["жильё приобретено", "жильё куплено"],
      ["квартиры приобретены", "квартиры куплены"],
      ["я приобрету", "я куплю"],
      ["ты приобретёшь", "ты купишь"],
      ["он приобретёт", "он купит"],
      ["мы приобретём", "мы купим"],
      ["вы приобретёте", "вы купите"],
      ["они приобретут", "они купят"],
      ["приобретя квартиру", "купив квартиру"],
      ["приобретённый объект", "купленный объект"],
      ["приобретённая квартира", "купленная квартира"],
      ["приобретённые объекты", "купленные объекты"],
      ["квартира приобретена", "квартира куплена"],
      ["клиент, приобретший квартиру", "клиент, купивший квартиру"],
      ["приобретшая семья", "купившая семья"],
      ["приобретшие жильё", "купившие жильё"],
    ];

    for (const [input, expected] of pairs) {
      expect(applyAllRules(input, rules), input).toBe(expected);
    }
  });

  it("содержит 84 правила для семейства «приобрести»", () => {
    expect(rules).toHaveLength(84);
  });
});
