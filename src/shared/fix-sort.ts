export type FixSortKey = {
  from: number;
  to: number;
  priority: number;
};

/** Слева направо; при равной позиции — выше priority раньше. */
export function compareFixesByPosition(a: FixSortKey, b: FixSortKey): number {
  if (a.from !== b.from) return a.from - b.from;
  if (a.to !== b.to) return a.to - b.to;
  return b.priority - a.priority;
}

/** Справа налево для apply, чтобы индексы слева оставались валидными. */
export function compareFixesForApply(a: FixSortKey, b: FixSortKey): number {
  if (a.from !== b.from) return b.from - a.from;
  if (a.to !== b.to) return b.to - a.to;
  return b.priority - a.priority;
}

export function orderFixesForApply<T extends FixSortKey>(fixes: readonly T[]): T[] {
  return [...fixes].sort(compareFixesForApply);
}
