import { afterEach, describe, expect, it } from "vitest";
import { selectedChoiceOptionIndex } from "./choice-selection";
import { state } from "./ui-state";

afterEach(() => {
  state.choiceSelection = {};
});

describe("selectedChoiceOptionIndex", () => {
  it("берёт форму из текста, пока пользователь не кликнул", () => {
    expect(selectedChoiceOptionIndex(0, 0, "всё", ["все", "всё"])).toBe(1);
    expect(selectedChoiceOptionIndex(0, 0, "ждете", ["ждите", "ждёте"])).toBe(1);
  });

  it("после клика использует сохранённый индекс, в том числе 0", () => {
    state.choiceSelection["1:2"] = 0;
    expect(selectedChoiceOptionIndex(1, 2, "всё", ["все", "всё"])).toBe(0);
  });
});
