import { describe, expect, it } from "vitest";
import type { TextFixDto } from "../shared/messages";
import { createChoiceResolution } from "./choice-resolution-core";
import {
  classifyManualApplySuccess,
  hasSavedChoiceDecision,
  type ManualApplyObservation,
} from "./manual-apply-success";

function fix(
  overrides: Partial<TextFixDto> & { policy?: TextFixDto["rule"]["applyPolicy"]; ruleId?: string } = {},
): TextFixDto {
  const { policy = "confirm", ruleId = "rule-1", rule, ...rest } = overrides;
  return {
    fixId: "f1",
    from: 0,
    to: 8,
    before: "напишите",
    after: "напишете",
    ...rest,
    rule: {
      id: ruleId,
      category: policy === "choice" ? "form_choice" : "typography",
      message: "m",
      applyPolicy: policy,
      priority: 1,
      ...(policy === "choice" ? { choiceOptions: ["напишите", "напишете"] } : {}),
      ...rule,
    },
  };
}

function observed(overrides: Partial<ManualApplyObservation> = {}): ManualApplyObservation {
  return {
    layerFound: true,
    threw: false,
    layerTextBefore: "напишите мне",
    appliedCount: 0,
    resolutionSaved: false,
    alreadySavedDecision: false,
    ...overrides,
  };
}

describe("classifyManualApplySuccess", () => {
  it("обычная и орфографическая замена успешны только после применения", () => {
    expect(classifyManualApplySuccess(fix({}), observed({ appliedCount: 1 }))).toEqual({
      track: "text_changed",
      event: "manual_fix_complete",
      action: "applied",
      kind: "confirm",
    });
    expect(
      classifyManualApplySuccess(
        fix({ ruleId: "orthography-spellcheck", before: "Кватира", after: "Квартира", to: 7 }),
        observed({ layerTextBefore: "Кватира", appliedCount: 1 }),
      ),
    ).toMatchObject({ track: "text_changed", kind: "orthography" });
  });

  it("пустой результат, устаревший фрагмент и замена без изменения не успешны", () => {
    const same = fix({ before: "напишите", after: "напишите" });
    expect(classifyManualApplySuccess(fix({}), observed({ appliedCount: 0 }))).toEqual({
      track: "none",
      reason: "empty",
    });
    expect(
      classifyManualApplySuccess(fix({}), observed({ layerTextBefore: "уже другое", appliedCount: 0 })),
    ).toEqual({ track: "none", reason: "stale" });
    expect(classifyManualApplySuccess(same, observed({ appliedCount: 0 }))).toEqual({
      track: "none",
      reason: "unchanged",
    });
    expect(
      classifyManualApplySuccess(fix({}), observed({ layerTextBefore: "напишете мне", appliedCount: 0 })),
    ).toEqual({ track: "none", reason: "repeat" });
  });

  it("нет слоя и исключение не увеличивают успех", () => {
    expect(classifyManualApplySuccess(fix({}), observed({ layerFound: false, appliedCount: 1 }))).toEqual({
      track: "none",
      reason: "missing_layer",
    });
    expect(classifyManualApplySuccess(fix({}), observed({ threw: true, appliedCount: 1 }))).toEqual({
      track: "none",
      reason: "exception",
    });
  });

  it("исходная форма choice — подтверждённое решение, не изменение текста", () => {
    const kept = fix({
      policy: "choice",
      before: "напишите",
      after: "напишите",
    });
    expect(
      classifyManualApplySuccess(kept, observed({ resolutionSaved: true, appliedCount: 0 })),
    ).toEqual({
      track: "decision_saved",
      event: "choice_resolved",
      action: "confirmed",
    });
    expect(
      classifyManualApplySuccess(kept, observed({ resolutionSaved: false })),
    ).toEqual({ track: "none", reason: "decision_not_saved" });
    expect(
      classifyManualApplySuccess(kept, observed({ resolutionSaved: true, alreadySavedDecision: true })),
    ).toEqual({ track: "none", reason: "repeat" });
  });

  it("choice с другой формой считается решением только после сохранения", () => {
    const changed = fix({ policy: "choice" });
    expect(
      classifyManualApplySuccess(changed, observed({ appliedCount: 1, resolutionSaved: true })),
    ).toEqual({
      track: "decision_saved",
      event: "choice_resolved",
      action: "confirmed",
    });
    expect(
      classifyManualApplySuccess(changed, observed({ appliedCount: 1, resolutionSaved: false })),
    ).toEqual({ track: "none", reason: "decision_not_saved" });
    expect(
      classifyManualApplySuccess(
        fix({ policy: "choice", after: "чужое" }),
        observed({ appliedCount: 1, resolutionSaved: true }),
      ),
    ).toEqual({ track: "none", reason: "not_allowed" });
  });
});

describe("hasSavedChoiceDecision", () => {
  it("находит уже сохранённую исходную форму и не путает её с другим словом", () => {
    const text = "напишите мне";
    const kept = fix({ policy: "choice", before: "напишите", after: "напишите" });
    const stored = createChoiceResolution(text, kept.rule.id, 0, 8, "напишите", "напишите");
    expect(hasSavedChoiceDecision(text, [stored], kept)).toBe(true);
    expect(hasSavedChoiceDecision(text, [], kept)).toBe(false);
    expect(hasSavedChoiceDecision("напишете мне", [stored], kept)).toBe(false);
  });
});
