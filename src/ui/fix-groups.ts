import { ORTHOGRAPHY_LAYOUT_RULE_ID, ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";

const SENTENCE_CAP_RULE_IDS = new Set([
  "cian-138-sentence-start-capitalize",
  "cian-138-numbered-list-capitalize",
]);

const NO_APPLY_ALL = new Set([ORTHOGRAPHY_SPELL_RULE_ID, ORTHOGRAPHY_LAYOUT_RULE_ID]);

export type FixGroup<T> = {
  id: string;
  title: string;
  canApplyAll: boolean;
  entries: T[];
};

/** Заглавные 138 — одна секция. Остальные confirm — по rule id, поэтому пары ё не склеиваются. */
export function confirmGroupId(ruleId: string): string {
  if (SENTENCE_CAP_RULE_IDS.has(ruleId)) return "sentence-cap";
  return ruleId;
}

export function confirmGroupAllowsApplyAll(groupId: string): boolean {
  return !NO_APPLY_ALL.has(groupId);
}

export function groupFixes<T extends { ruleId: string; message: string }>(
  items: readonly T[],
  groupIdOf: (ruleId: string) => string,
  canApplyAll: (groupId: string) => boolean,
): FixGroup<T>[] {
  const order: string[] = [];
  const byId = new Map<string, FixGroup<T>>();

  for (const item of items) {
    const id = groupIdOf(item.ruleId);
    const existing = byId.get(id);
    if (existing) {
      existing.entries.push(item);
      continue;
    }
    order.push(id);
    byId.set(id, {
      id,
      title: item.message,
      canApplyAll: canApplyAll(id),
      entries: [item],
    });
  }

  return order.map((id) => byId.get(id)!);
}
