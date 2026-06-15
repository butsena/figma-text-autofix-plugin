import { extractSheetGid, extractSpreadsheetId, toGvizJsonUrl } from "../sheet/google-sheets-url";
import type { PluginToUiMessage } from "../shared/messages";

const SHEET_FETCH_TIMEOUT_MS = 25_000;

type PendingSheetCsv = {
  resolve: (csv: string) => void;
  reject: (error: Error) => void;
};

const pendingByRequestId = new Map<string, PendingSheetCsv>();

/** Загрузка Google Sheets через JSONP в UI (обход CORS в sandbox плагина). */
export function fetchGoogleSheetCsvViaUi(fetchUrl: string): Promise<string> {
  const spreadsheetId = extractSpreadsheetId(fetchUrl);
  if (!spreadsheetId) {
    return Promise.reject(new Error("Не удалось определить ID таблицы из ссылки."));
  }

  const gid = extractSheetGid(fetchUrl);
  const requestId = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingByRequestId.delete(requestId);
      reject(new Error("Таймаут загрузки таблицы (25 с)."));
    }, SHEET_FETCH_TIMEOUT_MS);

    pendingByRequestId.set(requestId, {
      resolve: (csv) => {
        clearTimeout(timer);
        resolve(csv);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });

    figma.ui.postMessage({
      type: "plugin:fetchSheetCsv",
      requestId,
      spreadsheetId,
      gid,
      fetchUrl: toGvizJsonUrl(spreadsheetId, gid),
    } satisfies PluginToUiMessage);
  });
}

export function resolvePendingSheetCsv(
  requestId: string,
  ok: boolean,
  csv?: string,
  errorMessage?: string,
): void {
  const pending = pendingByRequestId.get(requestId);
  if (!pending) return;
  pendingByRequestId.delete(requestId);

  if (ok && typeof csv === "string") {
    pending.resolve(csv);
  } else {
    pending.reject(new Error(errorMessage || "Не удалось загрузить таблицу."));
  }
}
