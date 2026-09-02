/** Проверка и разбор пары Hunspell .aff + .dic. */

export type HunspellDictionary = {
  aff: string;
  dic: string;
  entryCount: number;
};

export function parseHunspellDictionary(aff: string, dic: string): HunspellDictionary | null {
  const affText = aff.trim();
  const dicText = dic.trim();
  if (!affText || !dicText) return null;
  if (!affText.includes("SET UTF-8")) return null;

  const header = dicText.split("\n", 1)[0]?.trim() ?? "";
  const entryCount = Number(header);
  if (!Number.isFinite(entryCount) || entryCount <= 0) return null;

  return { aff: affText, dic: dicText, entryCount };
}
