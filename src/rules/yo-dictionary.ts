import { capitalizeLike } from "../shared/case";
import { getYoCorrectionsMap } from "../lexicon/yo-curated-store";

export function getYoCorrection(word: string): string | null {
  const fromLower = getYoCorrectionsMap()[word.toLowerCase()];
  if (!fromLower) return null;
  const right = capitalizeLike(word, fromLower);
  if (right === word) return null;
  return right;
}
