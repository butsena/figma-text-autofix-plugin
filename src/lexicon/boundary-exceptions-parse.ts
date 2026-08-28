/** Парсинг `data/boundary-exceptions.txt` и удалённой копии из отдельного репозитория. */

export function parseBoundaryExceptions(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}
