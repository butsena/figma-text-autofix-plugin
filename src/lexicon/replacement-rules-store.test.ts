import { describe, expect, it, beforeEach } from "vitest";
import {
  applySheetRulesFromCsv,
  getSheetRulesLoadStats,
  resetSheetRulesToBundled,
} from "./replacement-rules-store";

describe("replacement-rules-store", () => {
  beforeEach(() => {
    resetSheetRulesToBundled();
  });

  it("подставляет remote CSV целиком без merge с bundled", () => {
    const remoteCsv = `исходные варианты,верный текст
тестовое,замена`;

    const ok = applySheetRulesFromCsv(remoteCsv);
    expect(ok).toBe(true);

    const stats = getSheetRulesLoadStats();
    expect(stats.fromRemote).toBe(true);
    expect(stats.totalCount).toBe(1);
  });

  it("при сбросе возвращает bundled", () => {
    applySheetRulesFromCsv(`исходные варианты,верный текст
тестовое,замена`);
    resetSheetRulesToBundled();

    const stats = getSheetRulesLoadStats();
    expect(stats.fromRemote).toBe(false);
    expect(stats.totalCount).toBeGreaterThan(1);
  });
});
