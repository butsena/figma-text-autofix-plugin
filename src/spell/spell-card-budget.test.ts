import { describe, expect, it } from "vitest";
import {
  MAX_SPELL_CARDS_PER_RUN,
  MAX_SPELL_CARDS_PER_TEXT,
  beginSpellCardBudget,
  endSpellCardBudget,
  takeSpellCardSlot,
} from "./spell-card-budget";

describe("spell card budget", () => {
  it("на слой не больше 12, на проход не больше 48", () => {
    beginSpellCardBudget();
    try {
      let taken = 0;
      for (let layer = 0; layer < 10; layer++) {
        let emitted = 0;
        for (let i = 0; i < 20; i++) {
          if (!takeSpellCardSlot(emitted)) break;
          emitted += 1;
          taken += 1;
        }
        expect(emitted).toBeLessThanOrEqual(MAX_SPELL_CARDS_PER_TEXT);
      }
      expect(taken).toBe(MAX_SPELL_CARDS_PER_RUN);
    } finally {
      endSpellCardBudget();
    }
  });

  it("без begin лимит только на слой", () => {
    endSpellCardBudget();
    let emitted = 0;
    while (takeSpellCardSlot(emitted)) emitted += 1;
    expect(emitted).toBe(MAX_SPELL_CARDS_PER_TEXT);
  });
});
