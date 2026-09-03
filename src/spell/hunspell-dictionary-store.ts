import { parseHunspellDictionary, type HunspellDictionary } from "./hunspell-dictionary-parse";

export type HunspellDictionaryLoadStats = {
  entryCount: number;
  fromRemote: boolean;
};

/** Источник большого словаря — только GitHub (в бандл не вшиваем). */
export const HUNSPELL_SOURCE = "GitHub text-autofix-spelling (LibreOffice ru_RU)";

type DictionaryState = {
  dict: HunspellDictionary | null;
  fromRemote: boolean;
};

let state: DictionaryState = { dict: null, fromRemote: false };

export function getHunspellDictionary(): HunspellDictionary | null {
  return state.dict;
}

export function getHunspellDictionaryLoadStats(): HunspellDictionaryLoadStats {
  return {
    entryCount: state.dict?.entryCount ?? 0,
    fromRemote: state.fromRemote,
  };
}

/** Загрузить Hunspell; пустой/битый → false, активный набор не меняется. */
export function applyHunspellDictionaryFromRaw(aff: string, dic: string): boolean {
  const parsed = parseHunspellDictionary(aff, dic);
  if (!parsed || parsed.entryCount === 0) return false;
  state = { dict: parsed, fromRemote: true };
  return true;
}

/** Сбросить словарь (нет fallback в бандле — орфография отключится). */
export function clearHunspellDictionary(): void {
  state = { dict: null, fromRemote: false };
}

/** @deprecated Используйте clearHunspellDictionary — bundled Hunspell удалён. */
export const resetHunspellDictionaryToBundled = clearHunspellDictionary;
