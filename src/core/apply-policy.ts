export type ApplyPolicy = "auto" | "confirm";

export const APPLY_POLICY_AUTO: ApplyPolicy = "auto";
export const APPLY_POLICY_CONFIRM: ApplyPolicy = "confirm";

export function resolveApplyPolicy(policy?: ApplyPolicy): ApplyPolicy {
  return policy ?? APPLY_POLICY_AUTO;
}

export function isConfirmPolicy(policy?: ApplyPolicy): boolean {
  return resolveApplyPolicy(policy) === APPLY_POLICY_CONFIRM;
}
