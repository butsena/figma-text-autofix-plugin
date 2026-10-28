import type { AnalyticsSpellingSource } from "../analytics/schema";

/** Сравнение для аналитики: не меняет сам текст замены, пробелы внутри и е/ё. */
function comparableSpelling(value: string): string {
  return value.trim().normalize("NFC").toLocaleLowerCase("ru");
}

/** Сравнивает исходную подсказку с уже сформированной фактической заменой. */
export function classifySpellingSource(
  before: string,
  suggested: string,
  after: string,
): AnalyticsSpellingSource {
  const suggestion = comparableSpelling(suggested);
  if (!suggestion || suggestion === comparableSpelling(before)) return "custom";
  return suggestion === comparableSpelling(after) ? "suggested" : "custom";
}

/** Старый UI или недопустимые метаданные не выдают себя за известный источник. */
export function normalizeSpellingSource(source: unknown): AnalyticsSpellingSource {
  return source === "suggested" || source === "custom" ? source : "unknown";
}
