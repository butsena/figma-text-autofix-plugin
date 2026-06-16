import { describe, expect, it } from "vitest";
import { parseTyVyCuratedRows } from "./ty-vy-curated";

describe("parseTyVyCuratedRows", () => {
  it("парсит пары и пропускает комментарии", () => {
    const raw = `# комментарий
нажми,нажмите
Нажми,Нажмите`;
    const rows = parseTyVyCuratedRows(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0].variants).toEqual(["нажми"]);
    expect(rows[0].replace).toBe("нажмите");
    expect(rows[0].category).toBe("cian_editorial");
    expect(rows[0].priority).toBe(59);
    expect(rows[0].message).toBe("Редполитика: глагол на «ты» → форма на «вы».");
  });

  it("поддерживает несколько исходников в кавычках", () => {
    const raw = `"найдёшь, найдешь",найдёте`;
    const rows = parseTyVyCuratedRows(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].variants).toEqual(["найдёшь", "найдешь"]);
    expect(rows[0].replace).toBe("найдёте");
  });
});
