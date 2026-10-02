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
    expect(getAmbiguousFormChoicesLoadStats().fromRemote).toBe(true);
    expect(getAmbiguousFormChoices()[0]?.options).toEqual(["тест", "тест2"]);
    expect(
      getAmbiguousFormChoices().some(
        (choice) => choice.options[0] === "напишите" && choice.options[1] === "напишете",
      ),
    ).toBe(true);
    expect(
      getAmbiguousFormChoices().some((choice) => choice.id === "cian-choice-budite-budete"),
    ).toBe(true);
    resetAmbiguousFormChoicesToBundled();
  });
});
