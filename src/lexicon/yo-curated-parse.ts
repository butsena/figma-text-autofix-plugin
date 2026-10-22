/** Список форм с «ё» → словарь «е→ё» для рантайма. */
export function parseYoCuratedCorrections(raw: string): Readonly<Record<string, string>> {
  const corrections: Record<string, string> = {};
  for (const line of raw.split(/\n/)) {
    const word = line.replace(/#.*$/, "").trim();
    if (!word || !/[ёЁ]/.test(word)) continue;
    const right = word.toLowerCase();
    const wrong = right.replace(/ё/g, "е");
    if (wrong !== right) corrections[wrong] = right;
  }
  return corrections;
}
