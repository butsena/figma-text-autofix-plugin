import { ungzip } from "pako";
import { createRemoteBackedStore, type RemoteBackedStore } from "../lexicon/remote-backed-store";
import { decodeBase64ToBytes, utf8BytesToString } from "../shared/utf8-bytes-to-string";
import {
  HUNSPELL_AFF_GZ_BASE64,
  HUNSPELL_DIC_GZ_BASE64,
  HUNSPELL_SOURCE,
} from "./hunspell-dict.generated";
import { parseHunspellDictionary, type HunspellDictionary } from "./hunspell-dictionary-parse";

export type HunspellDictionaryLoadStats = {
  entryCount: number;
  fromRemote: boolean;
};

export { HUNSPELL_SOURCE };

function decodeGzipBase64(base64: string): string {
  const binary = decodeBase64ToBytes(base64);
  const unzipped = ungzip(binary);
  return utf8BytesToString(unzipped);
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

let store: RemoteBackedStore<HunspellDictionary> | null = null;

function getStore(): RemoteBackedStore<HunspellDictionary> {
  if (!store) {
    store = createRemoteBackedStore(loadBundledDictionary(), (dict) => dict.entryCount);
  }
  return store;
}

export function getHunspellDictionary(): HunspellDictionary {
  return getStore().get();
}

export function getHunspellDictionaryLoadStats(): HunspellDictionaryLoadStats {
  const stats = getStore().getLoadStats();
  return { entryCount: stats.count, fromRemote: stats.fromRemote };
}

/** Загрузить Hunspell; пустой/битый → false, активный набор не меняется. */
export function applyHunspellDictionaryFromRaw(aff: string, dic: string): boolean {
  const parsed = parseHunspellDictionary(aff, dic);
  if (!parsed) return false;
  return getStore().apply(parsed);
}

export function resetHunspellDictionaryToBundled(): void {
  getStore().resetToBundled();
}
