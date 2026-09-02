import {
  HUNSPELL_AFF_GZ_BASE64,
  HUNSPELL_DIC_GZ_BASE64,
  HUNSPELL_SOURCE,
} from "./hunspell-dict.generated";
import { ungzip } from "pako";
import { createRemoteBackedStore } from "../lexicon/remote-backed-store";
import { parseHunspellDictionary, type HunspellDictionary } from "./hunspell-dictionary-parse";

export type HunspellDictionaryLoadStats = {
  entryCount: number;
  fromRemote: boolean;
};

export { HUNSPELL_SOURCE };

function decodeGzipBase64(base64: string): string {
  const binary = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return ungzip(binary, { toText: true });
}

function loadBundledDictionary(): HunspellDictionary {
  const aff = decodeGzipBase64(HUNSPELL_AFF_GZ_BASE64);
  const dic = decodeGzipBase64(HUNSPELL_DIC_GZ_BASE64);
  const parsed = parseHunspellDictionary(aff, dic);
  if (!parsed) {
    throw new Error("[text-autofix] bundled Hunspell dictionary is invalid");
  }
  return parsed;
}

const bundledDictionary = loadBundledDictionary();
const store = createRemoteBackedStore(bundledDictionary, (dict) => dict.entryCount);

export function getHunspellDictionary(): HunspellDictionary {
  return store.get();
}

export function getHunspellDictionaryLoadStats(): HunspellDictionaryLoadStats {
  const stats = store.getLoadStats();
  return { entryCount: stats.count, fromRemote: stats.fromRemote };
}

/** Загрузить Hunspell; пустой/битый → false, активный набор не меняется. */
export function applyHunspellDictionaryFromRaw(aff: string, dic: string): boolean {
  const parsed = parseHunspellDictionary(aff, dic);
  if (!parsed) return false;
  return store.apply(parsed);
}

export function resetHunspellDictionaryToBundled(): void {
  store.resetToBundled();
}
