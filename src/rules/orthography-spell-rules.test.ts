import { describe, expect, it } from "vitest";
import {
  ORTHOGRAPHY_LAYOUT_PRIORITY,
  ORTHOGRAPHY_LAYOUT_RULE_ID,
  ORTHOGRAPHY_SPELL_PRIORITY,
  ORTHOGRAPHY_SPELL_RULE_ID,
  isOrthographyRuleId,
  orthographyLayoutMessage,
  orthographySpellMessage,
} from "./orthography-spell-rules";

describe("orthography-spell-rules", () => {
  it("isOrthographyRuleId только для spell и layout", () => {
    expect(isOrthographyRuleId(ORTHOGRAPHY_SPELL_RULE_ID)).toBe(true);
    expect(isOrthographyRuleId(ORTHOGRAPHY_LAYOUT_RULE_ID)).toBe(true);
    expect(isOrthographyRuleId("orthography-ne-verb-split")).toBe(false);
    expect(isOrthographyRuleId("cian-138-sentence-start-capitalize")).toBe(false);
  });

  it("layout приоритетнее обычной орфографии", () => {
    expect(ORTHOGRAPHY_LAYOUT_PRIORITY).toBeGreaterThan(ORTHOGRAPHY_SPELL_PRIORITY);
  });

  it("сообщения содержат исходное слово", () => {
    expect(orthographySpellMessage("Кватира")).toBe(
      "Возможно, в слове «Кватира» опечатка или ошибка — проверьте",
    );
    expect(orthographyLayoutMessage("ghbdtn")).toBe(
      "Возможно, «ghbdtn» набрано в английской раскладке или это опечатка — проверьте",
    );
  });
});
