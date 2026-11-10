// Generates a narrow native Sheets migration; does not execute it or reset dashboard.
import { WORK } from "./t151-traffic-report.mjs";
export const ERROR_REPORT_SHEET_ID = 1440144;
export const ERROR_REPORT_TITLE = "Сбои и восстановления";

export function buildErrorReportPlan(periods) {
  if (periods.length !== 41) throw new Error("Expected the 41 existing report periods; inspect template first");
  const sheetId = ERROR_REPORT_SHEET_ID;
  const base = WORK + '*(events!F$2:F="plugin_error")';
  const outcome = value => 'IFERROR(REGEXMATCH(events!G$2:G;"""outcome""\\s*:\\s*""' + value + '""");FALSE)';
  const modern = outcome('(failed|recovered)');
  const rows = periods.map((p, i) => {
    if (typeof p.label !== "string" || !p.label.startsWith("=") ||
        typeof p.periodFilter !== "string" || (p.periodFilter && !p.periodFilter.startsWith("*(LEFT(events!A$2:A;10)"))) {
      throw new Error("Invalid existing period definition");
    }
    const n = i + 6, filter = base + p.periodFilter;
    return { values: [
      { userEnteredValue: { formulaValue: p.label } },
      { userEnteredValue: { formulaValue: '=SUMPRODUCT(' + filter + ')' } },
      { userEnteredValue: { formulaValue: '=IF(F' + n + '=0;"—";SUMPRODUCT(' + filter + '*' + outcome('failed') + '))' } },
      { userEnteredValue: { formulaValue: '=IF(F' + n + '=0;"—";SUMPRODUCT(' + filter + '*' + outcome('recovered') + '))' } },
      { userEnteredValue: { formulaValue: '=B' + n + '-F' + n } },
      { userEnteredValue: { formulaValue: '=SUMPRODUCT(' + filter + '*' + modern + ')' } },
    ] };
  });
  const textCell = (row, text, note) => ({
    updateCells: { range: { sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [{ values: [{ userEnteredValue: { stringValue: text }, ...(note ? { note } : {}) }] }],
      fields: note ? "userEnteredValue,note" : "userEnteredValue" },
  });
  const startFormula = '=IF(F6=0;"Новых рабочих записей с разделением исходов пока нет.";' +
    '"Первая полученная рабочая запись с новым учётом (UTC): "&LEFT(INDEX(SORT(FILTER(events!A$2:A;' +
    WORK + ';events!F$2:F="plugin_error";' + modern + ');1;TRUE);1;1);10))';
  return [
    { duplicateSheet: { sourceSheetId: 1350135, newSheetId: sheetId, newSheetName: ERROR_REPORT_TITLE, insertSheetIndex: 6 } },
    { updateCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 60, startColumnIndex: 0, endColumnIndex: 6 },
      rows: [], fields: "userEnteredValue,note" } },
    textCell(1, ERROR_REPORT_TITLE),
    textCell(2, "Сбой — не удалось выполнить действие; восстановление — работа продолжилась с запасным словарём. Исход прежних записей неизвестен. «—» означает, что в периоде ещё нет записей с новым учётом; это не доказательство отсутствия сбоев.",
      "Считаются полученные plugin_error, не неуспешные проверки и не процент успеха. Не включает ненаблюдаемые сбои, потери сети, закрытие и краши среды. Smoke исключён. Кэш без попытки обновления и предупреждения предварительной загрузки при успешной правке не считаются восстановлением."),
    { updateCells: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [{ values: [{ userEnteredValue: { formulaValue: startFormula } }] }], fields: "userEnteredValue" } },
    { updateCells: { range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 6 },
      rows: [{ values: ["Период", "Всего сигналов", "Сбой действия", "Восстановлено", "Исход неизвестен", "С новым учётом"]
        .map(stringValue => ({ userEnteredValue: { stringValue } })) }], fields: "userEnteredValue" } },
    { updateCells: { range: { sheetId, startRowIndex: 5, endRowIndex: 46, startColumnIndex: 0, endColumnIndex: 6 }, rows, fields: "userEnteredValue" } },
    { repeatCell: { range: { sheetId, startRowIndex: 5, endRowIndex: 46, startColumnIndex: 1, endColumnIndex: 6 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0" } } }, fields: "userEnteredFormat.numberFormat" } },
    { updateCells: { range: { sheetId: 1634415588, startRowIndex: 33, endRowIndex: 34, startColumnIndex: 0, endColumnIndex: 1 },
      rows: [{ values: [{ userEnteredValue: { stringValue: "Сигналы проблем (всего)" },
        note: "Полный полученный поток plugin_error, включая восстановления и старые записи без известного исхода. Это не число неуспешных проверок. Разбивка и начало нового учёта — на листе «Сбои и восстановления»." }] }],
      fields: "userEnteredValue,note" } },
  ];
}
