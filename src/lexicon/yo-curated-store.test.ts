import { describe, expect, it } from "vitest";
import { getYoCorrection } from "../rules/yo-dictionary";
import { parseYoCuratedCorrections } from "./yo-curated-parse";
import {
  applyYoCuratedFromRaw,
  getYoCuratedLoadStats,
  getYoCorrectionsMap,
  resetYoCuratedToBundled,
} from "./yo-curated-store";

describe("parseYoCuratedCorrections", () => {
  it("строит е→ё из списка форм", () => {
    expect(parseYoCuratedCorrections("ещё\n# коммент\nотчёт\n")).toEqual({
      еще: "ещё",
      отчет: "отчёт",
    });
  });
});

describe("yo-curated-store", () => {
  it("по умолчанию читает bundled", () => {
    resetYoCuratedToBundled();
    expect(getYoCuratedLoadStats().fromRemote).toBe(false);
    expect(Object.keys(getYoCorrectionsMap()).length).toBeGreaterThan(0);
    expect(getYoCorrection("еще")).toBe("ещё");
  });

  it("getYoCorrection сохраняет регистр и не трогает уже «ё»", () => {
    resetYoCuratedToBundled();
    expect(getYoCorrection("Еще")).toBe("Ещё");
    expect(getYoCorrection("ЕЩЕ")).toBe("ЕЩЁ");
    expect(getYoCorrection("ещё")).toBeNull();
    expect(getYoCorrection("неттакогослова")).toBeNull();
  });

  it("применяет remote-список", () => {
    expect(applyYoCuratedFromRaw("самолёт\n")).toBe(true);
    expect(getYoCuratedLoadStats().fromRemote).toBe(true);
    expect(getYoCorrection("самолет")).toBe("самолёт");
    expect(getYoCorrection("еще")).toBeNull();
    resetYoCuratedToBundled();
  });
});
