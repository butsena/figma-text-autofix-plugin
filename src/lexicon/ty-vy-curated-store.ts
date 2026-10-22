import bundledRaw from "../../data/ty-vy-curated.txt?raw";
import { stripUtf8Bom } from "../shared/text-normalize";
import type { ReplacementRow } from "./replacement-rows";
import { parseTyVyCuratedRows } from "../rules/ty-vy-curated";
import { createRemoteBackedStore } from "./remote-backed-store";

export type TyVyCuratedLoadStats = {
  count: number;
  fromRemote: boolean;
};

const bundledRows = parseTyVyCuratedRows(bundledRaw);
const store = createRemoteBackedStore(bundledRows, (rows) => rows.length);

export function getTyVyCuratedRows(): readonly ReplacementRow[] {
  return store.get();
}

export function getTyVyCuratedLoadStats(): TyVyCuratedLoadStats {
  return store.getLoadStats();
}

/** Загрузить строки; пустой/битый → false, активный набор не меняется. */
export function applyTyVyCuratedFromRaw(raw: string): boolean {
  return store.apply(parseTyVyCuratedRows(stripUtf8Bom(raw)));
}

export function resetTyVyCuratedToBundled(): void {
  store.resetToBundled();
}
