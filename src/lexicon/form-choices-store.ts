import bundledRaw from "../../data/ambiguous-form-choices.txt?raw";
import { stripUtf8Bom } from "../shared/text-normalize";
import {
  parseAmbiguousFormChoices,
  type AmbiguousFormChoice,
} from "../rules/choice/ambiguous-form-choices-parse";
import { createRemoteBackedStore } from "./remote-backed-store";

export type FormChoicesLoadStats = {
  count: number;
  fromRemote: boolean;
};

const bundledChoices = parseAmbiguousFormChoices(bundledRaw);
const store = createRemoteBackedStore(bundledChoices, (choices) => choices.length);

export function getAmbiguousFormChoices(): readonly AmbiguousFormChoice[] {
  return store.get();
}

export function getFormChoicesLoadStats(): FormChoicesLoadStats {
  return store.getLoadStats();
}

/** Загрузить список choice-пар; пустой/битый → false, активный набор не меняется. */
export function applyFormChoicesFromRaw(raw: string): boolean {
  try {
    const choices = parseAmbiguousFormChoices(stripUtf8Bom(raw));
    if (choices.length === 0) return false;
    return store.apply(choices);
  } catch {
    return false;
  }
}

export function resetFormChoicesToBundled(): void {
  store.resetToBundled();
}
