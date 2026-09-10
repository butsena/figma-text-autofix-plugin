/** Полуинтервалы [from, to) пересекаются. */
export function rangesOverlap(
  from: number,
  to: number,
  otherFrom: number,
  otherTo: number,
): boolean {
  return from < otherTo && to > otherFrom;
}
