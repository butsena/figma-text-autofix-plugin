import { describe, expect, it } from "vitest";
import {
  applyAmbiguousFormChoicesFromRaw,
  getAmbiguousFormChoices,
  getAmbiguousFormChoicesLoadStats,
  resetAmbiguousFormChoicesToBundled,
} from "./ambiguous-form-choices-store";

describe("ambiguous-form-choices-store", () => {
  it("по умолчанию читает bundled пары", () => {
    expect(getAmbiguousFormChoicesLoadStats().fromRemote).toBe(false);
    expect(getAmbiguousFormChoices().length).toBeGreaterThan(0);
  });

  it("применяет remote-файл и обновляет статистику", () => {
    const ok = applyAmbiguousFormChoicesFromRaw("тест - тест2 - подсказка\n");
    expect(ok).toBe(true);
    expect(getAmbiguousFormChoicesLoadStats()).toMatchObject({ fromRemote: true, count: 1 });
    expect(getAmbiguousFormChoices()[0]?.options).toEqual(["тест", "тест2"]);
    resetAmbiguousFormChoicesToBundled();
  });
});
