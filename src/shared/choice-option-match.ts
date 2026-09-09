import { foldYoToYe } from "./case";

/**
 * Индекс кнопки choice, соответствующей найденному слову.
 * Сначала точное сравнение без учёта регистра (чтобы «все» и «всё» не сливались),
 * затем — единственный вариант, совпадающий после замены ё→е («ждете» → «ждёте»).
 */
export function matchingChoiceOptionIndex(
  before: string,
  options: readonly string[],
): number | null {
  const beforeLower = before.toLowerCase();
  const exact = options.findIndex((option) => option.toLowerCase() === beforeLower);
  if (exact >= 0) return exact;

  const beforeFolded = foldYoToYe(beforeLower);
  const foldHits: number[] = [];
  for (let i = 0; i < options.length; i++) {
    if (foldYoToYe(options[i]!.toLowerCase()) === beforeFolded) {
      foldHits.push(i);
    }
  }
  return foldHits.length === 1 ? foldHits[0]! : null;
}
