import type { AutofixRule } from "./autofix-engine";

/** Явное объявление правила (удобно в модулях с десятками записей). */
export function rule(def: AutofixRule): AutofixRule {
  return def;
}

export function rules(list: AutofixRule[]): AutofixRule[] {
  return list;
}
