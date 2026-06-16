import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveLexiconMessage } from "./lexicon-messages";
import { parseSheetReplacementRows } from "./replacement-rows";

const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../data/text-replacements.csv");

describe("resolveLexiconMessage", () => {
  it("группирует приобретение", () => {
    expect(resolveLexiconMessage(["приобрести"], "купить")).toBe(
      "Редполитика: «приобрести» → «купить».",
    );
    expect(resolveLexiconMessage(["приобретёнными", "приобретенными"], "купленными")).toBe(
      "Редполитика: «приобрести» → «купить».",
    );
  });

  it("группирует денежные средства и промокод", () => {
    expect(resolveLexiconMessage(["денежные средства"], "деньги")).toBe(
      "Редполитика: «денежные средства» → «деньги».",
    );
    expect(resolveLexiconMessage(["промо-код", "промо код"], "промокод")).toBe(
      "Редполитика: «промокод» — слитно.",
    );
  });

  it("для неизвестной пары оставляет конкретную замену", () => {
    expect(resolveLexiconMessage(["foo"], "bar")).toBe("Редполитика: «foo» → «bar».");
  });
});

describe("bundled lexicon CSV", () => {
  it("все строки попадают в известные группы", () => {
    const raw = readFileSync(csvPath, "utf8");
    const rows = parseSheetReplacementRows(raw);
    const unique = new Set(rows.map((r) => r.message));
    expect(rows.length).toBeGreaterThan(0);
    expect(unique.size).toBe(8);
    expect([...unique].sort()).toEqual([
      "Редполитика: «далее» → «дальше».",
      "Редполитика: «денежные средства» → «деньги».",
      "Редполитика: «кешбэк» — единое написание.",
      "Редполитика: «онлайн» — слитно.",
      "Редполитика: «первоначальный взнос» → «первый взнос».",
      "Редполитика: «приобрести» → «купить».",
      "Редполитика: «промокод» — слитно.",
      "Редполитика: «риэлтор» → «риелтор».",
    ]);
  });
});
