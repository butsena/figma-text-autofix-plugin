export type ApplyPolicy = "auto" | "confirm" | "choice";

export const APPLY_POLICY_AUTO: ApplyPolicy = "auto";
export const APPLY_POLICY_CONFIRM: ApplyPolicy = "confirm";
export const APPLY_POLICY_CHOICE: ApplyPolicy = "choice";

export function resolveApplyPolicy(policy?: ApplyPolicy): ApplyPolicy {
  return policy ?? APPLY_POLICY_AUTO;
}

export function isConfirmPolicy(policy?: ApplyPolicy): boolean {
  return resolveApplyPolicy(policy) === APPLY_POLICY_CONFIRM;
}

export function isChoicePolicy(policy?: ApplyPolicy): boolean {
  return resolveApplyPolicy(policy) === APPLY_POLICY_CHOICE;
}

/** Не применять автоматически: confirm и choice. */
export function isManualPolicy(policy?: ApplyPolicy): boolean {
  const resolved = resolveApplyPolicy(policy);
  return resolved === APPLY_POLICY_CONFIRM || resolved === APPLY_POLICY_CHOICE;
}
