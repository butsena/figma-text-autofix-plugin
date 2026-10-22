import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

describe("spellcheck-preference", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("дефолт выкл, без clientStorage", async () => {
    const {
      loadSpellcheckPreference,
      getCachedSpellcheckActive,
      getCachedSpellcheckPreference,
    } = await import("./spellcheck-preference");

    expect(loadSpellcheckPreference()).toBe(false);
    expect(getCachedSpellcheckActive()).toBe(false);
    expect(getCachedSpellcheckPreference()).toBe(false);
  });

  it("enableSpellcheckForSession включает только в памяти", async () => {
    const {
      enableSpellcheckForSession,
      loadSpellcheckPreference,
      getCachedSpellcheckPreference,
      getCachedSpellcheckActive,
      resetSpellcheckPreferenceCacheForTests,
    } = await import("./spellcheck-preference");

    expect(enableSpellcheckForSession()).toBe(true);
    expect(getCachedSpellcheckPreference()).toBe(true);
    expect(getCachedSpellcheckActive()).toBe(true);
    expect(loadSpellcheckPreference()).toBe(true);

    resetSpellcheckPreferenceCacheForTests();
    expect(loadSpellcheckPreference()).toBe(false);
  });

  it("isSpellcheckActive учитывает kill-switch", async () => {
    const { isSpellcheckActive } = await import("./spellcheck-preference");
    expect(isSpellcheckActive(true)).toBe(true);
    expect(isSpellcheckActive(false)).toBe(false);
  });
});
