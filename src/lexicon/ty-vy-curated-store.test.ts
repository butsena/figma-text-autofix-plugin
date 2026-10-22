import { describe, expect, it } from "vitest";
import {
  applyTyVyCuratedFromRaw,
  getTyVyCuratedLoadStats,
  getTyVyCuratedRows,
  resetTyVyCuratedToBundled,
} from "./ty-vy-curated-store";

describe("ty-vy-curated-store", () => {
  it("по умолчанию читает bundled строки", () => {
    resetTyVyCuratedToBundled();
    expect(getTyVyCuratedLoadStats().fromRemote).toBe(false);
    expect(getTyVyCuratedRows().length).toBeGreaterThan(0);
  });

  it("применяет remote-файл", () => {
    expect(applyTyVyCuratedFromRaw("кликни,кликните\n")).toBe(true);
    expect(getTyVyCuratedLoadStats().fromRemote).toBe(true);
    expect(getTyVyCuratedRows()[0]?.variants).toEqual(["кликни"]);
    expect(getTyVyCuratedRows()[0]?.replace).toBe("кликните");
    resetTyVyCuratedToBundled();
  });

  it("отклоняет пустой remote", () => {
    expect(applyTyVyCuratedFromRaw("# пусто\n")).toBe(false);
    expect(getTyVyCuratedLoadStats().fromRemote).toBe(false);
  });
});
