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
