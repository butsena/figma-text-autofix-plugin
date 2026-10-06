import { describe, expect, it } from "vitest";
import type { LexiconLoadStatusDto, LexiconResourceLoadStatus } from "../shared/messages";
import {
  buildDictionaryLexStatusRow,
  buildEditorialLexStatusRow,
  buildSpellExceptionsLexStatusRow,
  buildTechLexiconStatusRows,
  collectLexiconErrorMessages,
  formatLexCount,
  formatTechLexiconStatusBodyHtml,
  formatWordsDetail,
} from "./ui-lexicon-status";

function res(
  partial: Partial<LexiconResourceLoadStatus> & Pick<LexiconResourceLoadStatus, "count">,
): LexiconResourceLoadStatus {
  return {
    ok: true,
    fromRemote: true,
    ...partial,
  };
}

function lex(partial: Partial<LexiconLoadStatusDto> = {}): LexiconLoadStatusDto {
  return {
    replacements: res({ count: 124 }),
    boundaryExceptions: res({ count: 38 }),
    ambiguousFormChoices: res({ count: 27 }),
    spellDictionary: res({ count: 164000 }),
    spellSupplement: res({ count: 80 }),
    spellWhitelist: res({ count: 50 }),
    spellExtraUniqueCount: 129,
    ...partial,
  };
}

describe("formatLexCount", () => {
  it("ставит пробел в тысячах", () => {
    expect(formatLexCount(164000)).toBe("164 000");
    expect(formatLexCount(27)).toBe("27");
  });
});

describe("buildEditorialLexStatusRow", () => {
  it("remote OK — count и GitHub", () => {
    expect(buildEditorialLexStatusRow("Замены", res({ count: 124 }), "replacements")).toEqual({
      title: "Замены",
      detail: "124 правила",
      tone: "ok",
      badge: "github",
    });
    expect(buildEditorialLexStatusRow("Без точки", res({ count: 38 }), "boundary")).toMatchObject({
      detail: "38 фраз",
      badge: "github",
    });
    expect(buildEditorialLexStatusRow("Формы слов", res({ count: 27 }), "forms")).toMatchObject({
      detail: "27 пар",
      badge: "github",
    });
  });

  it("fallback замен/без точки — текст макета без count", () => {
    const row = buildEditorialLexStatusRow(
      "Замены",
      res({ ok: false, fromRemote: false, count: 12, errorMessage: "Failed to fetch" }),
      "replacements",
    );
    expect(row).toEqual({
      title: "Замены",
      detail: "Встроенный словарь, GitHub не загрузился",
      tone: "warn",
      badge: "bundled",
    });
    expect(row.detail).not.toContain("12");
    expect(row.detail).not.toContain("Failed");
  });

  it("fallback форм — count в скобках, не unavailable", () => {
    const row = buildEditorialLexStatusRow(
      "Формы слов",
      res({ ok: false, fromRemote: false, count: 6, errorMessage: "timeout" }),
      "forms",
    );
    expect(row.detail).toBe("Встроенный список (6 пар), GitHub не загрузился");
    expect(row.tone).toBe("warn");
    expect(row.badge).toBe("bundled");
  });
});

describe("buildDictionaryLexStatusRow", () => {
  it("remote OK и unavailable", () => {
    expect(buildDictionaryLexStatusRow(res({ count: 164000 }))).toEqual({
      title: "Словарь",
      detail: "164 000 слов",
      tone: "ok",
      badge: "github",
    });
    expect(
      buildDictionaryLexStatusRow(
        res({ ok: false, fromRemote: false, count: 0, errorMessage: "offline" }),
      ),
    ).toEqual({
      title: "Словарь",
      detail: "Проверка недоступна",
      tone: "err",
      badge: "offline",
    });
  });
});

describe("buildSpellExceptionsLexStatusRow", () => {
  it("оба remote / оба fallback / partial оба сочетания", () => {
    expect(
      buildSpellExceptionsLexStatusRow(res({ count: 80 }), res({ count: 50 }), 129),
    ).toEqual({
      title: "Слова-исключения",
      detail: formatWordsDetail(129),
      tone: "ok",
      badge: "github",
    });

    expect(
      buildSpellExceptionsLexStatusRow(
        res({ ok: false, fromRemote: false, count: 27, errorMessage: "a" }),
        res({ ok: false, fromRemote: false, count: 16, errorMessage: "b" }),
        40,
      ),
    ).toEqual({
      title: "Слова-исключения",
      detail: "Встроенные списки, GitHub не загрузился",
      tone: "warn",
      badge: "bundled",
    });

    const partialSup = buildSpellExceptionsLexStatusRow(
      res({ count: 80 }),
      res({ ok: false, fromRemote: false, count: 16, errorMessage: "wl" }),
      90,
    );
    const partialWl = buildSpellExceptionsLexStatusRow(
      res({ ok: false, fromRemote: false, count: 27, errorMessage: "sup" }),
      res({ count: 50 }),
      70,
    );
    expect(partialSup).toEqual({
      title: "Слова-исключения",
      detail: "Не все загрузились",
      tone: "warn",
      badge: "partial",
    });
    expect(partialWl).toEqual(partialSup);
    expect(partialSup.detail).not.toMatch(/\d/);
  });
});

describe("collectLexiconErrorMessages + HTML", () => {
  it("сохраняет ошибки обоих источников и не рисует сырой текст в UI", () => {
    const status = lex({
      replacements: res({
        ok: false,
        fromRemote: false,
        count: 12,
        errorMessage: "Failed to fetch",
      }),
      spellSupplement: res({
        ok: false,
        fromRemote: false,
        count: 27,
        errorMessage: "sup-down",
      }),
      spellWhitelist: res({
        ok: false,
        fromRemote: false,
        count: 16,
        errorMessage: "wl-down",
      }),
      spellDictionary: res({
        ok: false,
        fromRemote: false,
        count: 0,
        errorMessage: "dic-down",
      }),
      spellExtraUniqueCount: 40,
    });

    expect(
      collectLexiconErrorMessages(status.spellSupplement, status.spellWhitelist),
    ).toEqual(["sup-down", "wl-down"]);
    expect(collectLexiconErrorMessages(status.spellDictionary)).toEqual(["dic-down"]);

    const html = formatTechLexiconStatusBodyHtml(status, true);
    expect(html).toContain("Замены");
    expect(html).toContain("Встроенный словарь, GitHub не загрузился");
    expect(html).toContain("Проверка недоступна");
    expect(html).toContain("Нет связи со словарём");
    expect(html).toContain("Встроенные списки, GitHub не загрузился");
    expect(html).not.toContain("Failed to fetch");
    expect(html).not.toContain("sup-down");
    expect(html).not.toContain("wl-down");
    expect(html).not.toContain("dic-down");

    const rows = buildTechLexiconStatusRows(status, true);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.title)).toEqual([
      "Замены",
      "Без точки",
      "Формы слов",
      "Словарь",
      "Слова-исключения",
    ]);
  });
});
