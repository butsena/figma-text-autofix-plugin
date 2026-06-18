export function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function displayText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function countConfirmFixes(
  confirmCards: Array<{ fixes?: unknown[] }>,
): number {
  return confirmCards.reduce((n, card) => n + (card.fixes ? card.fixes.length : 0), 0);
}

export function detailsOpenAttr(isOpen: boolean): string {
  return isOpen ? " open" : "";
}

const SENTENCE_PERIOD_RULE_IDS: Record<string, true> = {
  "cian-139-sentence-terminal-period": true,
  "cian-139a-implicit-sentence-period": true,
  "cian-139b-single-sentence-remove-period": true,
};

/** Человекочитаемая категория правки в отчёте UI. */
export function formatFixCategoryLabel(category: string, ruleId?: string): string {
  if (ruleId && SENTENCE_PERIOD_RULE_IDS[ruleId]) return "Редполитика";
  if (category === "cian_editorial") return "Редполитика";
  return category;
}
