import { describe, expect, it } from "vitest";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";
import type { TextFixDto } from "../shared/messages";
import {
  isPersistedManualResolution,
  resolveChosenWordRangeAfterApply,
} from "./apply-manual-fix-helpers";

function dto(partial: Partial<TextFixDto> & Pick<TextFixDto, "from" | "to" | "before" | "after">): TextFixDto {
  return {
    fixId: "x",
    rule: {
      id: "cian-choice-ishchite-ishchete",
      category: "form_choice",
      message: "msg",
      priority: 1,
      applyPolicy: "choice",
    },
    ...partial,
  };
}

describe("isPersistedManualResolution", () => {
  it("true для choice и орфографии", () => {
    expect(isPersistedManualResolution(dto({ from: 0, to: 1, before: "а", after: "б" }))).toBe(true);
    expect(
      isPersistedManualResolution(
        dto({
          from: 0,
          to: 1,
          before: "а",
          after: "б",
          rule: {
            id: ORTHOGRAPHY_SPELL_RULE_ID,
            category: "orthography",
            message: "орф",
            priority: 1,
            applyPolicy: "confirm",
          },
        }),
      ),
    ).toBe(true);
  });

  it("false для обычного confirm", () => {
    expect(
      isPersistedManualResolution(
        dto({
          from: 0,
          to: 1,
          before: "а",
          after: "б",
          rule: {
            id: "cian-ty-vy",
            category: "cian_editorial",
            message: "msg",
            priority: 1,
            applyPolicy: "confirm",
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("resolveChosenWordRangeAfterApply", () => {
  it("оставляет ожидаемый диапазон, если слово на месте", () => {
    expect(resolveChosenWordRangeAfterApply("ищите квартиру", { from: 0, before: "ищете", after: "ищите" })).toEqual({
      from: 0,
      to: 5,
    });
  });

  it("ищет слово рядом после сдвига", () => {
    expect(
      resolveChosenWordRangeAfterApply("Найдите ищите квартиру", {
        from: 0,
        before: "ищете",
        after: "ищите",
      }),
    ).toEqual({ from: 8, to: 13 });
  });
});
