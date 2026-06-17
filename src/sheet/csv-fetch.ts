export function fetchUrlWithCacheBust(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}

export function formatFetchError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.reason === "string" && o.reason) return o.reason;
    if (typeof o.description === "string" && o.description) return o.description;
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}") return json;
    } catch {
      // ignore
    }
  }
  return "Сетевая ошибка при загрузке CSV.";
}

export function looksLikeHtmlNotCsv(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("<!") || t.startsWith("<html") || t.includes("<!DOCTYPE");
}

export function previewResponseText(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}
