import { toGvizCsvUrl } from "../sheet/google-sheets-url";

/** ID таблицы команды (между `/d/` и `/edit` в браузере). */
export const TEAM_SPREADSHEET_ID = "1MHRXUqdkuUAJTerU4fEWtvhUH8Fbi5SkVjSo_5SSH90";

/** Номер листа из `#gid=…` в URL вкладки. */
export const TEAM_SHEET_GID = "0";

/** URL gviz CSV по умолчанию для таблицы команды. */
export const TEXT_REPLACEMENTS_CSV_URL = toGvizCsvUrl(TEAM_SPREADSHEET_ID, TEAM_SHEET_GID);
