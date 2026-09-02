import { describe, expect, it } from "vitest";
import {
  APPLY_POLICY_AUTO,
  APPLY_POLICY_CHOICE,
  APPLY_POLICY_CONFIRM,
  isChoicePolicy,
  isConfirmPolicy,
  isManualPolicy,
  resolveApplyPolicy,
} from "./apply-policy";

describe("resolveApplyPolicy", () => {
  it("возвращает auto по умолчанию", () => {
    expect(resolveApplyPolicy()).toBe(APPLY_POLICY_AUTO);
    expect(resolveApplyPolicy(undefined)).toBe(APPLY_POLICY_AUTO);
  });

  it("сохраняет явную политику", () => {
    expect(resolveApplyPolicy(APPLY_POLICY_CONFIRM)).toBe(APPLY_POLICY_CONFIRM);
    expect(resolveApplyPolicy(APPLY_POLICY_CHOICE)).toBe(APPLY_POLICY_CHOICE);
  });
});

describe("isConfirmPolicy", () => {
  it("true только для confirm", () => {
    expect(isConfirmPolicy(APPLY_POLICY_CONFIRM)).toBe(true);
    expect(isConfirmPolicy(APPLY_POLICY_AUTO)).toBe(false);
    expect(isConfirmPolicy(APPLY_POLICY_CHOICE)).toBe(false);
  });
});

describe("isChoicePolicy", () => {
  it("true только для choice", () => {
    expect(isChoicePolicy(APPLY_POLICY_CHOICE)).toBe(true);
    expect(isChoicePolicy(APPLY_POLICY_AUTO)).toBe(false);
    expect(isChoicePolicy(APPLY_POLICY_CONFIRM)).toBe(false);
  });
});

describe("isManualPolicy", () => {
  it("true для confirm и choice", () => {
    expect(isManualPolicy(APPLY_POLICY_CONFIRM)).toBe(true);
    expect(isManualPolicy(APPLY_POLICY_CHOICE)).toBe(true);
  });

  it("false для auto и по умолчанию", () => {
    expect(isManualPolicy(APPLY_POLICY_AUTO)).toBe(false);
    expect(isManualPolicy()).toBe(false);
  });
});
