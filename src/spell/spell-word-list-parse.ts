/** Парсинг текстовых списков слов (whitelist, supplement). */

export function parseSpellWordList(raw: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];

  for (const line of raw.split(/\n/)) {
    const word = line.replace(/#.*$/, "").trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }

  return words.sort((a, b) => a.localeCompare(b, "ru"));
}

export function mergeSpellWordLists(...lists: readonly string[][]): string[] {
  return parseSpellWordList(lists.flat().join("\n"));
}
