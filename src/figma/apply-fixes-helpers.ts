/** Меняется только регистр (с → С, Вас → вас). */
export function isCaseOnlyChange(before: string, after: string): boolean {
  return (
    before.length > 0 &&
    before.length === after.length &&
    before !== after &&
    before.toLowerCase() === after.toLowerCase()
  );
}
