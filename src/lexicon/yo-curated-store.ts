import bundledRaw from "../../data/yo-curated.txt?raw";
import { stripUtf8Bom } from "../shared/text-normalize";
import { createRemoteBackedStore } from "./remote-backed-store";
import { parseYoCuratedCorrections } from "./yo-curated-parse";

export type YoCuratedLoadStats = {
  count: number;
  fromRemote: boolean;
};

const bundledCorrections = parseYoCuratedCorrections(bundledRaw);
const store = createRemoteBackedStore(
  bundledCorrections,
  (map) => Object.keys(map).length,
);

export function getYoCorrectionsMap(): Readonly<Record<string, string>> {
  return store.get();
}

export function getYoCuratedLoadStats(): YoCuratedLoadStats {
  return store.getLoadStats();
}

/** Загрузить список форм с ё; пустой/битый → false. */
export function applyYoCuratedFromRaw(raw: string): boolean {
  return store.apply(parseYoCuratedCorrections(stripUtf8Bom(raw)));
}

export function resetYoCuratedToBundled(): void {
  store.resetToBundled();
}
