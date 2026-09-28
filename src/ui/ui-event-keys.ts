export function parseKey(key: string | null, parts: number): number[] | null {
  if (!key) return null;
  const values = key.split(":").map(Number);
  if (values.length !== parts || values.some((value) => Number.isNaN(value))) {
    return null;
  }
  return values;
}
