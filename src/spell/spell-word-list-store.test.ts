import { beforeEach, describe, expect, it } from "vitest";
import {
  applySpellSupplementFromRaw,
  applySpellWhitelistFromRaw,
  getAllSpellExtraWords,
  getSpellSupplementLoadStats,
  getSpellSupplementWords,
  getSpellWhitelistLoadStats,
  getSpellWhitelistWords,
  resetSpellSupplementToBundled,
  resetSpellWhitelistToBundled,
} from "./spell-word-list-store";

describe("spell-word-list-store", () => {
  beforeEach(() => {
    resetSpellSupplementToBundled();
    resetSpellWhitelistToBundled();
  });

  it("по умолчанию читает bundled списки", () => {
    expect(getSpellSupplementLoadStats().fromRemote).toBe(false);
    expect(getSpellWhitelistLoadStats().fromRemote).toBe(false);
    expect(getSpellSupplementWords().length).toBeGreaterThan(0);
    expect(getAllSpellExtraWords().length).toBeGreaterThan(0);
  });

  it("применяет remote supplement и сбрасывает на bundled", () => {
    expect(applySpellSupplementFromRaw("Альфа\nБета\n")).toBe(true);
    expect(getSpellSupplementLoadStats()).toMatchObject({ fromRemote: true, count: 2 });
    expect([...getSpellSupplementWords()]).toEqual(["Альфа", "Бета"]);
    resetSpellSupplementToBundled();
    expect(getSpellSupplementLoadStats().fromRemote).toBe(false);
  });

  it("не применяет пустой whitelist", () => {
    const before = getSpellWhitelistLoadStats();
    expect(applySpellWhitelistFromRaw("# только коммент\n\n")).toBe(false);
    expect(getSpellWhitelistLoadStats()).toEqual(before);
  });

  it("merge supplement+whitelist в getAllSpellExtraWords", () => {
    applySpellSupplementFromRaw("один\n");
    applySpellWhitelistFromRaw("два\n");
    expect(getAllSpellExtraWords()).toEqual(expect.arrayContaining(["один", "два"]));
    expect(getAllSpellExtraWords()).toHaveLength(2);
    expect([...getSpellWhitelistWords()]).toEqual(["два"]);
  });
});
