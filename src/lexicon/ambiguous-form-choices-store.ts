import bundledRaw from "../../data/ambiguous-form-choices.txt?raw";
import { createRemoteBackedStore } from "./remote-backed-store";
import { stripUtf8Bom } from "../shared/text-normalize";
import {
  parseAmbiguousFormChoices,
  type AmbiguousFormChoice,
} from "./ambiguous-form-choices-parse";

export type AmbiguousFormChoicesLoadStats = {
  count: number;
  fromRemote: boolean;
};

const bundledChoices = parseAmbiguousFormChoices(bundledRaw);
const store = createRemoteBackedStore(bundledChoices, (choices) => choices.length);

export function getAmbiguousFormChoices(): readonly AmbiguousFormChoice[] {
  return store.get();
}

export function getAmbiguousFormChoice(ruleId: string): AmbiguousFormChoice | undefined {
  return store.get().find((choice) => choice.id === ruleId);
}

export function getAmbiguousFormChoicesLoadStats(): AmbiguousFormChoicesLoadStats {
  return store.getLoadStats();
}

/** Загрузить пары; пустой/битый → false, активный набор не меняется. */
export function applyAmbiguousFormChoicesFromRaw(raw: string): boolean {
  try {
    return store.apply(parseAmbiguousFormChoices(stripUtf8Bom(raw)));
  } catch {
    return false;
  }
}

export function resetAmbiguousFormChoicesToBundled(): void {
  store.resetToBundled();
}
