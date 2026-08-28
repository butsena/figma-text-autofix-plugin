import boundaryExceptionsRaw from "../../../data/boundary-exceptions.txt?raw";

const LETTER = /[а-яёa-zА-Яа-яЁёA-Za-z]/u;

export function parseBoundaryExceptions(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

export const BOUNDARY_EXCEPTIONS = parseBoundaryExceptions(boundaryExceptionsRaw);

export function matchesBoundaryExceptionAt(
  text: string,
  index: number,
  phrases: readonly string[] = BOUNDARY_EXCEPTIONS,
): boolean {
  const tailLower = text.slice(index).toLowerCase();
  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    if (!tailLower.startsWith(phraseLower)) continue;
    const after = text[index + phrase.length];
    if (after !== undefined && LETTER.test(after)) continue;
    return true;
  }
  return false;
}
