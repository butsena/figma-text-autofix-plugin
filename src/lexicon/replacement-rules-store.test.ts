import { describe, expect, it, beforeEach } from "vitest";
import {
  applyLexiconReplacementsFromCsv,
  getLexiconRulesLoadStats,
  resetLexiconReplacementsToBundled,
} from "./replacement-rules-store";

describe("replacement-rules-store", () => {
  beforeEach(() => {
    resetLexiconReplacementsToBundled();
  });

  it("подставляет remote CSV целиком без merge с bundled", () => {
    const remoteCsv = `исходные варианты,верный текст
тестовое,замена`;

    const ok = applyLexiconReplacementsFromCsv(remoteCsv);
    expect(ok).toBe(true);

    const stats = getLexiconRulesLoadStats();
    expect(stats.fromRemote).toBe(true);
    expect(stats.totalCount).toBe(1);
  });

  it("при сбросе возвращает bundled", () => {
    applyLexiconReplacementsFromCsv(`исходные варианты,верный текст
тестовое,замена`);
    resetLexiconReplacementsToBundled();

    const stats = getLexiconRulesLoadStats();
    expect(stats.fromRemote).toBe(false);
    expect(stats.totalCount).toBeGreaterThan(1);
  });
});
