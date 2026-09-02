import { describe, expect, it } from "vitest";
import {
  applyFormChoicesFromRaw,
  getAmbiguousFormChoices,
  getFormChoicesLoadStats,
  resetFormChoicesToBundled,
} from "./form-choices-store";

describe("form-choices-store", () => {
  it("bundled содержит две choice-пары", () => {
    expect(getAmbiguousFormChoices()).toHaveLength(2);
    expect(getFormChoicesLoadStats().fromRemote).toBe(false);
  });

  it("подставляет remote и откатывается на bundled", () => {
    const remote = `# id: test-choice
foo - bar - hint`;
    expect(applyFormChoicesFromRaw(remote)).toBe(true);
    expect(getAmbiguousFormChoices()).toHaveLength(1);
    expect(getFormChoicesLoadStats().fromRemote).toBe(true);

    resetFormChoicesToBundled();
    expect(getAmbiguousFormChoices()).toHaveLength(2);
    expect(getFormChoicesLoadStats().fromRemote).toBe(false);
  });

  it("не принимает битый remote", () => {
    const before = getAmbiguousFormChoices().length;
    expect(applyFormChoicesFromRaw("not a valid line")).toBe(false);
    expect(getAmbiguousFormChoices()).toHaveLength(before);
  });
});
