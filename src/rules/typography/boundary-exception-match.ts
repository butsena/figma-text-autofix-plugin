import { getBoundaryExceptions } from "../../lexicon/boundary-exceptions-store";
import { LATIN_CYRILLIC_LETTER } from "../../shared/letters";

export function matchesBoundaryExceptionAt(
  text: string,
  index: number,
  phrases: readonly string[] = getBoundaryExceptions(),
): boolean {
  const tailLower = text.slice(index).toLowerCase();
  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    if (!tailLower.startsWith(phraseLower)) continue;
    const after = text[index + phrase.length];
    if (after !== undefined && LATIN_CYRILLIC_LETTER.test(after)) continue;
    return true;
  }
  return false;
}
