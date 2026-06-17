function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function gvizJsonToCsv(data: {
  status?: string;
  errors?: Array<{ message?: string }>;
  table?: { rows?: Array<{ c?: Array<{ v?: unknown } | null> }> };
}): string {
  if (!data || data.status === "error") {
    const msg = (data && data.errors && data.errors[0] && data.errors[0].message) || "Ошибка Google Таблицы";
    throw new Error(msg);
  }
  const rows = data.table && data.table.rows;
  if (!rows || !rows.length) throw new Error("Таблица пуста");
  return rows
    .map(function (row) {
      const cells = row.c || [];
      return cells
        .map(function (cell) {
          return cell && cell.v != null ? escapeCsvCell(cell.v) : "";
        })
        .join(",");
    })
    .join("\n");
}

declare global {
  interface Window {
    google?: {
      visualization?: {
        Query?: {
          setResponse?: (data: Parameters<typeof gvizJsonToCsv>[0]) => void;
        };
      };
    };
  }
}

/** Google Sheets в Figma: fetch блокируется CORS → загрузка через <script> (gviz JSON). */
export function fetchSheetViaGvizJsonp(spreadsheetId: string, gid: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    const url =
      "https://docs.google.com/spreadsheets/d/" +
      spreadsheetId +
      "/gviz/tq?gid=" +
      encodeURIComponent(gid) +
      "&tqx=out:json";
    let script: HTMLScriptElement | null = null;
    const timer = setTimeout(function () {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      reject(new Error("Таймаут загрузки таблицы"));
    }, 24000);

    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = {
      setResponse: function (data) {
        clearTimeout(timer);
        if (script && script.parentNode) script.parentNode.removeChild(script);
        try {
          resolve(gvizJsonToCsv(data));
        } catch (e) {
          reject(e);
        }
      },
    };

    script = document.createElement("script");
    script.src = url;
    script.onerror = function () {
      clearTimeout(timer);
      reject(
        new Error(
          "Браузер заблокировал загрузку таблицы. Проверьте доступ «все с ссылкой» → Читатель.",
        ),
      );
    };
    document.head.appendChild(script);
  });
}
