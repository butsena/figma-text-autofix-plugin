import { YO_CORRECTIONS } from "./yo-curated.generated";

function capitalizeLike(source: string, target: string): string {
  if (!source) return target;
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return target.toUpperCase();
  }
  if (source.charAt(0) === source.charAt(0).toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target;
}

/** Замена «е» на «ё» по курируемому списку (IT / недвижимость). */
export function getYoCorrection(word: string): string | null {
  const fromLower = YO_CORRECTIONS[word.toLowerCase()];
  if (!fromLower) return null;
  const right = capitalizeLike(word, fromLower);
  if (right === word) return null;
  return right;
}
