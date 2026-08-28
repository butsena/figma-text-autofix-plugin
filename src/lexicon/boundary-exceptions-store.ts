import bundledRaw from "../../data/boundary-exceptions.txt?raw";
import { stripUtf8Bom } from "../shared/text-normalize";
import { parseBoundaryExceptions } from "./boundary-exceptions-parse";
import { createRemoteBackedStore } from "./remote-backed-store";

export type BoundaryExceptionsLoadStats = {
  count: number;
  fromRemote: boolean;
};

const bundledExceptions = parseBoundaryExceptions(bundledRaw);
const store = createRemoteBackedStore(bundledExceptions, (phrases) => phrases.length);

export function getBoundaryExceptions(): readonly string[] {
  return store.get();
}

export function getBoundaryExceptionsLoadStats(): BoundaryExceptionsLoadStats {
  return store.getLoadStats();
}

/** Загрузить список исключений; пустой/битый → false, активный набор не меняется. */
export function applyBoundaryExceptionsFromRaw(raw: string): boolean {
  return store.apply(parseBoundaryExceptions(stripUtf8Bom(raw)));
}

export function resetBoundaryExceptionsToBundled(): void {
  store.resetToBundled();
}
