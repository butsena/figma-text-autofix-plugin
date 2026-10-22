import { describe, expect, it } from "vitest";
import {
  MAX_SPELL_SKIP_COUNT,
  beginPluginRun,
  markSpellSkippedThisSession,
  wasSpellSkippedThisSession,
} from "./choice-skip-session";

describe("spell skip session", () => {
  it("помнит skip только до следующего запуска плагина", () => {
    beginPluginRun();
    expect(wasSpellSkippedThisSession("spell", "кватира")).toBe(false);
    markSpellSkippedThisSession("spell", "кватира");
    expect(wasSpellSkippedThisSession("spell", "кватира")).toBe(true);
    expect(wasSpellSkippedThisSession("spell", "квартира")).toBe(false);
    expect(wasSpellSkippedThisSession("other", "кватира")).toBe(false);

    beginPluginRun();
    expect(wasSpellSkippedThisSession("spell", "кватира")).toBe(false);
  });

  it("держит порог постоянного скрытия на трёх skip", () => {
    expect(MAX_SPELL_SKIP_COUNT).toBe(3);
  });
});
