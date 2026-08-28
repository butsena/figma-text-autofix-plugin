import { YO_CORRECTIONS } from "./yo-curated.generated";
import { capitalizeLike } from "../shared/case";
export function getYoCorrection(word: string): string | null {
  const fromLower = YO_CORRECTIONS[word.toLowerCase()];
  if (!fromLower) return null;
  const right = capitalizeLike(word, fromLower);
  if (right === word) return null;
  return right;
}
