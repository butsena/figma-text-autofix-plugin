// Pure migration planner: no network, never resets sheets or edits historical events.
export const TRAFFIC_SHEET_ID = 1510151;
export const TRAFFIC_TITLE = "Режимы запусков";
const h = "events!H$2:H", e = "LOWER(TRIM(events!E$2:E))";
export const WORK = `(((${h}="production")+(${h}="unknown")+(${h}=""))*(${e}<>"smoke"))`;
export const BAD = `(((${h}<>"production")*(${h}<>"test")*(${h}<>"unknown")*(${h}<>""))+(${h}="production")*(${e}="smoke"))`;
export const TEST = `(((${h}="test")+(${e}="smoke")>0)*(${BAD}=0))`;
export const PROD = `((${h}="production")*(${e}<>"smoke"))`;
export const UNKNOWN = `(((${h}="")+(${h}="unknown"))*(${e}<>"smoke"))`;

export function classifyTraffic(version, mode) {
  if (![undefined, "", "unknown", "test", "production"].includes(mode) || (mode === "production" && String(version).trim().toLowerCase() === "smoke")) return "invalid";
  if (mode === "test" || String(version).trim().toLowerCase() === "smoke") return "test";
  return mode === "production" ? "production" : "unknown";
}

export function migrateTrafficFormula(formula, title, row, col) {
  if (!formula.includes("events!")) return formula.replaceAll("Тестовая версия smoke исключена.", "Проверочные события исключены.");
  let f = formula;
  if (/^=COUNTIFS\(events!F:F;"[a-z_]+";events!E:E;"<>smoke"\)$/.test(f)) {
    const event = f.match(/events!F:F;"([a-z_]+)"/)[1];
    return `=SUMPRODUCT(${WORK}*(events!F$2:F="${event}"))`;
  }
  f = f.replaceAll('(LOWER(TRIM(events!E$2:E))<>"smoke")', WORK)
    .replaceAll('LOWER(TRIM(events!E$2:E))<>"smoke"', WORK)
    .replaceAll('(LOWER(TRIM(events!E$2:E))="smoke")', TEST);
  if (title === "Методика" && row === 34 && col === 1) f = f.replace('events!F$2:F="spellcheck_requested"', `events!F$2:F="spellcheck_requested";${WORK}`);
  if (title === "Графики" && row === 122 && col === 0) f = "=IFERROR(" + f.slice(1).replace('FILTER(events!A2:A;events!A2:A<>"")', `FILTER(events!A2:A;events!A2:A<>"";${WORK})`) + ';"")';
  // An unseen raw event formula must be reviewed, never silently missed.
  if (!f.includes(WORK) && !f.includes(TEST)) throw new Error(`Unhandled event formula ${title}:${row + 1}:${col + 1}`);
  return f;
}

export function buildTrafficReportPlan(cells) {
  if (cells.some(c => c.title === TRAFFIC_TITLE || (c.title === "events" && c.col === 7 && c.value))) {
    throw new Error("Source already migrated or H occupied; inspect a fresh snapshot instead of replaying a migration");
  }
  const requests = [];
  const text = (sheetId, row, col, value, note) => requests.push({ updateCells: { start: { sheetId, rowIndex: row, columnIndex: col },
    rows: [{ values: [{ userEnteredValue: { stringValue: value }, ...(note ? { note } : {}) }] }], fields: note ? "userEnteredValue,note" : "userEnteredValue" } });
  const changes = cells.filter(c => c.value.formulaValue).map(c => ({ ...c, formula: migrateTrafficFormula(c.value.formulaValue, c.title, c.row, c.col) })).filter(c => c.formula !== c.value.formulaValue);
  const groups = new Map();
  for (const c of changes) {
    const key = `${c.sheetId}:${c.row}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  for (const group of groups.values()) {
    group.sort((a,b) => a.col - b.col);
    let run = [];
    const flush = () => { if (run.length) requests.push({ updateCells: { start: { sheetId: run[0].sheetId, rowIndex: run[0].row, columnIndex: run[0].col },
      rows: [{ values: run.map(c => ({ userEnteredValue: { formulaValue: c.formula } })) }], fields: "userEnteredValue" } }); run = []; };
    for (const c of group) { if (run.length && c.col !== run.at(-1).col + 1) flush(); run.push(c); } flush();
  }
  // This header may be written only after a fresh read confirms H is entirely unused.
  text(109242577, 0, 7, "traffic_mode", "production — явная обычная работа; test — проверка; unknown или пусто — режим неизвестен. История A:G не переписана.");
  text(912356281, 33, 0, "Проверочные события (test и прежний smoke) исключены из рабочих итогов, графиков, часов/рублей и дат покрытия. Прежний накопительный итог включает неизвестную историю: он не гарантированно очищен от всех тестов. Разделение — на листе «Режимы запусков».");
  text(1634415588, 1, 0, "Полученные события, не уникальные пользователи · проверки исключены, неизвестная история сохранена · даты UTC · текущие периоды неполные");
  text(1634415588, 34, 0, "Запросы орфографии: тест");
  text(1930978787, 1, 0, "Полученные события · проверки исключены, неизвестная история сохранена · даты UTC · запуски ≠ люди · текущие периоды неполные · техническое время ≠ время пользователя");
  text(871470193, 2, 0, "Стоимость часа включает взносы. Доли ролей — допущение. Проверки исключены; история без режима остаётся неизвестной. Даты — UTC, текущие периоды неполные. Подробности — «Режимы запусков».");
  const sid = TRAFFIC_SHEET_ID;
  requests.push({ duplicateSheet: { sourceSheetId: 1350135, newSheetId: sid, newSheetName: TRAFFIC_TITLE, insertSheetIndex: 7 } });
  requests.push({ updateCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 60, startColumnIndex: 0, endColumnIndex: 6 }, rows: [], fields: "userEnteredValue,note" } });
  text(sid, 0, 0, TRAFFIC_TITLE);
  text(sid, 1, 0, "Количество полученных записей, не людей, макетов или исправлений. «Обычная работа» — явная отметка отправителя; «Без режима» — неизвестное происхождение. Проверки исключены из рабочих сводок; неизвестная история сохранена.");
  requests.push({ updateCells: { start: { sheetId: sid, rowIndex: 2, columnIndex: 0 }, rows: [{ values: [{ userEnteredValue: { formulaValue:
    `=IF(B6=0;"Явных рабочих записей пока нет.";"Первая полученная явная рабочая запись (UTC): "&LEFT(INDEX(SORT(FILTER(events!A$2:A;events!A$2:A<>"";${PROD});1;TRUE);1;1);10))` } }] }], fields: "userEnteredValue" } });
  requests.push({ updateCells: { start: { sheetId: sid, rowIndex: 4, columnIndex: 0 }, rows: [{ values: ["Период", "Обычная работа", "Проверка", "Без режима", "Ошибка данных", "Всего записей"].map(stringValue => ({ userEnteredValue: { stringValue } })) }], fields: "userEnteredValue" } });
  const source = cells.filter(c => c.title === "Сбои и восстановления" && c.col === 1 && c.row >= 5 && c.row <= 45).sort((a,b) => a.row-b.row);
  if (source.length !== 41) throw new Error("Expected 41 source periods");
  const rows = source.map((c,i) => {
    const period = c.value.formulaValue.match(/\*\(LEFT\(events!A\$2:A;10\)[\s\S]*(?=\)$)/)?.[0] ?? "";
    if (i > 0 && !period) throw new Error("Missing period filter");
    const count = filter => `=SUMPRODUCT((events!A$2:A<>"")*${filter}${period})`;
    return { values: [ { userEnteredValue: { formulaValue: `='Сбои и восстановления'!A${i+6}` } },
      ...[PROD, TEST, UNKNOWN, BAD, "1"].map(f => ({ userEnteredValue: { formulaValue: count(f) } })) ] };
  });
  requests.push({ updateCells: { start: { sheetId: sid, rowIndex: 5, columnIndex: 0 }, rows, fields: "userEnteredValue" } });
  requests.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 5, endRowIndex: 46, startColumnIndex: 1, endColumnIndex: 6 }, cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0" } } }, fields: "userEnteredFormat.numberFormat" } });
  return { requests, changedFormulaCount: changes.length, changes };
}
