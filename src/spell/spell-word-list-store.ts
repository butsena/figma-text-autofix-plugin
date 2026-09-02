import bundledSupplementRaw from "../../data/spell-supplement.txt?raw";
import bundledWhitelistRaw from "../../data/spell-whitelist.txt?raw";
import { stripUtf8Bom } from "../shared/text-normalize";
import { createRemoteBackedStore } from "../lexicon/remote-backed-store";
import { mergeSpellWordLists, parseSpellWordList } from "./spell-word-list-parse";

export type SpellWordListLoadStats = {
  count: number;
  fromRemote: boolean;
};

const bundledSupplement = parseSpellWordList(bundledSupplementRaw);
const bundledWhitelist = parseSpellWordList(bundledWhitelistRaw);

const supplementStore = createRemoteBackedStore(bundledSupplement, (words) => words.length);
const whitelistStore = createRemoteBackedStore(bundledWhitelist, (words) => words.length);

export function getSpellSupplementWords(): readonly string[] {
  return supplementStore.get();
}

export function getSpellWhitelistWords(): readonly string[] {
  return whitelistStore.get();
}

export function getSpellSupplementLoadStats(): SpellWordListLoadStats {
  return supplementStore.getLoadStats();
}

export function getSpellWhitelistLoadStats(): SpellWordListLoadStats {
  return whitelistStore.getLoadStats();
}

export function getAllSpellExtraWords(): string[] {
  return mergeSpellWordLists([...getSpellSupplementWords()], [...getSpellWhitelistWords()]);
}

/** Загрузить доп. слова; пустой/битый → false, активный набор не меняется. */
export function applySpellSupplementFromRaw(raw: string): boolean {
  return supplementStore.apply(parseSpellWordList(stripUtf8Bom(raw)));
}

/** Загрузить whitelist; пустой/битый → false, активный набор не меняется. */
export function applySpellWhitelistFromRaw(raw: string): boolean {
  return whitelistStore.apply(parseSpellWordList(stripUtf8Bom(raw)));
}

export function resetSpellSupplementToBundled(): void {
  supplementStore.resetToBundled();
}

export function resetSpellWhitelistToBundled(): void {
  whitelistStore.resetToBundled();
}
