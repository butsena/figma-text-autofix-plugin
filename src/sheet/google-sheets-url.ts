/** ID таблицы только до следующего `/`, `?` или `#`. */
const SPREADSHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/|$|[?#])/;

export function isGoogleSheetsUrl(url: string): boolean {
  return url.includes("docs.google.com/spreadsheets");
}

/** CSV через gviz (без редиректа на googleusercontent). */
export function toGvizCsvUrl(spreadsheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

export function toGvizJsonUrl(spreadsheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${gid}&tqx=out:json`;
}

export function extractSpreadsheetId(url: string): string | null {
  const m = url.match(SPREADSHEET_ID_RE);
  if (!m) return null;
  const id = m[1];
  if (id.length < 30 || id.length > 60) return null;
  return id;
}

export function extractSheetGid(url: string): string {
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  return gidMatch ? gidMatch[1] : "0";
}

/** Любая ссылка на таблицу → канонический gviz CSV URL. */
export function resolveSheetFetchUrl(input: string, fallbackGvizUrl: string): string {
  const fallback = fallbackGvizUrl.trim();
  const u = input.trim();
  if (!u) return fallback;

  const spreadsheetId = extractSpreadsheetId(u);
  if (!spreadsheetId) return fallback;

  return toGvizCsvUrl(spreadsheetId, extractSheetGid(u));
}

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
  return "Сетевая ошибка при загрузке таблицы.";
}

export function looksLikeHtmlNotCsv(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("<!") || t.startsWith("<html") || t.includes("<!DOCTYPE");
}

export function previewResponseText(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}
