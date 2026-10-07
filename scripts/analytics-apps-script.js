/**
 * Google Apps Script — коллектор schema v1 для Text Autofix.
 *
 * Как развернуть (ручной шаг analytics-1b):
 * 1. Создайте Google Таблицу, например «Text Autofix analytics».
 * 2. Расширения → Apps Script → вставьте этот файл целиком.
 * 3. Сохраните проект. Выполните onceSetup() один раз (Выполнить).
 *    (Имена с хвостовым _ в Apps Script скрыты из списка — не используем.)
 * 4. Развернуть → Новое развёртывание → Тип: Веб-приложение
 *    - Выполнять от имени: меня
 *    - У кого есть доступ: Все (или «Все, у кого есть ссылка» —
 *      Figma plugin шлёт без Google-логина пользователя)
 * 5. Скопируйте URL вида https://script.google.com/.../exec
 *    в src/config/analytics-config.ts → endpointUrl
 *
 * Лист events создаётся автоматически.
 * Лист dashboard: выполните setupDashboard() один раз (Выполнить).
 * Формулы пишутся setValue("=…") с `;` — так же, как ручная вставка в RU-таблице.
 * (setFormulaLocal в Apps Script нет; setFormula с запятыми у вас давал #ERROR!.)
 */

var SCHEMA_VERSION = 1;
var MAX_BODY_CHARS = 4000;
var MAX_SESSION_LEN = 64;
var MAX_VERSION_LEN = 32;

var EVENT_NAMES = {
  plugin_open: true,
  scan_complete: true,
  auto_fix_complete: true,
  manual_fix_complete: true,
  choice_resolved: true,
  plugin_error: true,
};

var EVENT_HEADERS = [
  "server_time",
  "client_time",
  "schema_version",
  "session_id",
  "plugin_version",
  "event",
  "payload_json",
];

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "";
    if (!raw || raw.length > MAX_BODY_CHARS) {
      return jsonResponse_(400, { ok: false, error: "body" });
    }
    var body = JSON.parse(raw);
    var validated = validateEnvelope_(body);
    if (!validated.ok) {
      return jsonResponse_(400, { ok: false, error: validated.error });
    }
    appendEvent_(validated.envelope);
    return jsonResponse_(200, { ok: true });
  } catch (err) {
    return jsonResponse_(500, { ok: false, error: "server" });
  }
}

/** Health-check из браузера. */
function doGet() {
  return jsonResponse_(200, { ok: true, service: "text-autofix-analytics", schema_version: SCHEMA_VERSION });
}

function onceSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("events");
  if (!sheet) sheet = ss.insertSheet("events");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(EVENT_HEADERS);
    sheet.setFrozenRows(1);
  }
}

function validateEnvelope_(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "envelope" };
  if (body.schema_version !== SCHEMA_VERSION) return { ok: false, error: "schema_version" };
  if (typeof body.event !== "string" || !EVENT_NAMES[body.event]) {
    return { ok: false, error: "event" };
  }
  if (typeof body.session_id !== "string" || body.session_id.length < 8 || body.session_id.length > MAX_SESSION_LEN) {
    return { ok: false, error: "session_id" };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(body.session_id)) return { ok: false, error: "session_id" };
  if (typeof body.plugin_version !== "string" || !body.plugin_version || body.plugin_version.length > MAX_VERSION_LEN) {
    return { ok: false, error: "plugin_version" };
  }
  if (typeof body.client_time !== "string" || body.client_time.length > 40) {
    return { ok: false, error: "client_time" };
  }
  if (!body.payload || typeof body.payload !== "object") return { ok: false, error: "payload" };

  var payloadError = validatePayload_(body.event, body.payload);
  if (payloadError) return { ok: false, error: payloadError };

  return {
    ok: true,
    envelope: {
      client_time: body.client_time,
      schema_version: SCHEMA_VERSION,
      session_id: body.session_id,
      plugin_version: body.plugin_version,
      event: body.event,
      payload: body.payload,
    },
  };
}

function validatePayload_(event, payload) {
  function intOk(v) {
    return typeof v === "number" && isFinite(v) && v >= 0 && Math.floor(v) === v;
  }
  switch (event) {
    case "plugin_open":
      return typeof payload.has_text_layers === "boolean" ? null : "payload.has_text_layers";
    case "scan_complete":
      return ["checked_layers", "found_fixes", "confirm_fixes", "choice_fixes", "duration_ms"].every(function (k) {
        return intOk(payload[k]);
      })
        ? null
        : "payload.scan";
    case "auto_fix_complete":
      if (!["found", "applied", "not_applied", "duration_ms"].every(function (k) {
        return intOk(payload[k]);
      })) {
        return "payload.auto";
      }
      if (!payload.categories || typeof payload.categories !== "object") return "payload.categories";
      return null;
    case "manual_fix_complete":
      if (payload.action !== "applied" && payload.action !== "skipped") return "payload.action";
      if (payload.kind !== "confirm" && payload.kind !== "orthography") return "payload.kind";
      return null;
    case "choice_resolved":
      if (payload.action !== "confirmed" && payload.action !== "skipped") return "payload.action";
      return null;
    case "plugin_error":
      if (typeof payload.stage !== "string" || !payload.stage) return "payload.stage";
      if (typeof payload.code !== "string" || !payload.code) return "payload.code";
      if (payload.message != null || payload.stack != null) return "payload.forbidden";
      return null;
    default:
      return "event";
  }
}

function appendEvent_(envelope) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("events");
    if (!sheet) {
      onceSetup();
      sheet = ss.getSheetByName("events");
    }
    sheet.appendRow([
      new Date().toISOString(),
      envelope.client_time,
      envelope.schema_version,
      envelope.session_id,
      envelope.plugin_version,
      envelope.event,
      JSON.stringify(envelope.payload),
    ]);
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse_(code, obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ручной тест из редактора Apps Script (Выполнить).
 * После onceSetup и деплоя лучше слать POST снаружи; эта функция пишет строку напрямую.
 */
function smokeAppend() {
  onceSetup();
  appendEvent_({
    client_time: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    session_id: "sess_smoke_test_01",
    plugin_version: "0.18.0",
    event: "plugin_open",
    payload: { has_text_layers: true },
  });
}

/**
 * Пишет формулу с `;` (русская локаль) через setValue.
 * placeholder вроде {{DAY}} подменяется из replacements.
 */
function setDashFormula_(sheet, a1, template, replacements) {
  var formula = template;
  if (replacements) {
    var keys = Object.keys(replacements);
    for (var i = 0; i < keys.length; i++) {
      formula = formula.split(keys[i]).join(replacements[keys[i]]);
    }
  }
  sheet.getRange(a1).setValue(formula);
}

/** Сводка B2–B17. Хвост: Автоправки → Ошибки → Автоправки не сработали. */
function fillSummaryFormulas_(sheet) {
  setDashFormula_(sheet, "B2", '=COUNTIF(events!F:F;"plugin_open")');
  setDashFormula_(sheet, "B3", '=COUNTIF(events!F:F;"scan_complete")');
  setDashFormula_(sheet, "B4", '=COUNTIF(events!F:F;"auto_fix_complete")');
  setDashFormula_(sheet, "B5", '=COUNTIF(events!F:F;"manual_fix_complete")');
  setDashFormula_(
    sheet,
    "B6",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B7",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""orthography""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B8",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""confirm""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B9",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B10",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""orthography""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B11",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G)))*(ISNUMBER(SEARCH("""kind"":""confirm""";events!G2:G))))',
  );
  setDashFormula_(sheet, "B12", '=COUNTIF(events!F:F;"choice_resolved")');
  setDashFormula_(
    sheet,
    "B13",
    '=SUMPRODUCT((events!F2:F="choice_resolved")*(ISNUMBER(SEARCH("""action"":""confirmed""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B14",
    '=SUMPRODUCT((events!F2:F="choice_resolved")*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "B15",
    '=SUM(ARRAYFORMULA(IF(events!F2:F="auto_fix_complete";IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""applied"":(\\d+)"));0);0)))',
  );
  setDashFormula_(sheet, "B16", '=COUNTIF(events!F:F;"plugin_error")');
  setDashFormula_(
    sheet,
    "B17",
    '=SUM(ARRAYFORMULA(IF(events!F2:F="auto_fix_complete";IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""not_applied"":(\\d+)"));0);0)))',
  );
}

function clearLegendBorders_(sheet) {
  sheet.getRange("J18:K26").setBorder(false, false, false, false, false, false);
}

/**
 * Не очищает лист: хвост сводки A/B15–17 и границы J18:K26.
 * Порядок: Автоправки → Ошибки → Автоправки не сработали.
 */
function polishDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("dashboard");
  if (!sheet) {
    throw new Error("Нет листа dashboard — сначала setupDashboard()");
  }
  sheet.getRange("A15").setValue("Автоправки");
  sheet.getRange("A16").setValue("Ошибки");
  sheet.getRange("A17").setValue("Автоправки не сработали");
  setDashFormula_(
    sheet,
    "B15",
    '=SUM(ARRAYFORMULA(IF(events!F2:F="auto_fix_complete";IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""applied"":(\\d+)"));0);0)))',
  );
  setDashFormula_(sheet, "B16", '=COUNTIF(events!F:F;"plugin_error")');
  setDashFormula_(
    sheet,
    "B17",
    '=SUM(ARRAYFORMULA(IF(events!F2:F="auto_fix_complete";IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""not_applied"":(\\d+)"));0);0)))',
  );
  clearLegendBorders_(sheet);
  SpreadsheetApp.flush();
}

/**
 * Создаёт / перезаписывает лист dashboard: сводка, день, месяц, год.
 * Выполнить из редактора: setupDashboard.
 * Требует лист events. Не трогает Web App /exec.
 */
function setupDashboard() {
  onceSetup();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("dashboard");
  if (!sheet) {
    sheet = ss.insertSheet("dashboard");
  } else {
    sheet.clear();
  }

  sheet.getRange("A1").setValue("Text Autofix — сводка (не уникальные пользователи)");
  sheet.getRange("A1").setFontWeight("bold");

  var summaryLabels = [
    [2, "Запуски"],
    [3, "Сканы"],
    [4, "Авто"],
    [5, "Ручные"],
    [6, "→ Исправить"],
    [7, "→→ орфография"],
    [8, "→→ confirm"],
    [9, "→ Пропустить"],
    [10, "→→ орфография"],
    [11, "→→ confirm"],
    [12, "Выбор"],
    [13, "→ Подтвердить"],
    [14, "→ Пропустить"],
    [15, "Автоправки"],
    [16, "Ошибки"],
    [17, "Автоправки не сработали"],
  ];
  for (var i = 0; i < summaryLabels.length; i++) {
    sheet.getRange(summaryLabels[i][0], 1).setValue(summaryLabels[i][1]);
  }

  fillSummaryFormulas_(sheet);
  clearLegendBorders_(sheet);

  sheet.getRange("A19").setValue("По дням (UTC-дата из server_time)");
  sheet.getRange("A19").setFontWeight("bold");
  sheet
    .getRange("A20:H20")
    .setValues([["День", "Запуски", "Сканы", "Авто", "Ручн. испр.", "Ручн. skip", "Choice OK", "Ошибки"]]);

  var dayOpen =
    '=SUMPRODUCT((events!F2:F="plugin_open")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd")))';
  var dayScan =
    '=SUMPRODUCT((events!F2:F="scan_complete")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd")))';
  var dayAuto =
    '=SUMPRODUCT((events!F2:F="auto_fix_complete")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd")))';
  var dayManApp =
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd"))*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G))))';
  var dayManSkip =
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd"))*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))';
  var dayChoice =
    '=SUMPRODUCT((events!F2:F="choice_resolved")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd"))*(ISNUMBER(SEARCH("""action"":""confirmed""";events!G2:G))))';
  var dayErr =
    '=SUMPRODUCT((events!F2:F="plugin_error")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd")))';

  for (var d = 0; d <= 6; d++) {
    var row = 21 + d;
    var dayRef = "A" + row;
    if (d === 0) {
      setDashFormula_(sheet, dayRef, "=TODAY()");
    } else {
      setDashFormula_(sheet, dayRef, "=A21-" + d);
    }
    var rep = { "{{DAY}}": dayRef };
    setDashFormula_(sheet, "B" + row, dayOpen, rep);
    setDashFormula_(sheet, "C" + row, dayScan, rep);
    setDashFormula_(sheet, "D" + row, dayAuto, rep);
    setDashFormula_(sheet, "E" + row, dayManApp, rep);
    setDashFormula_(sheet, "F" + row, dayManSkip, rep);
    setDashFormula_(sheet, "G" + row, dayChoice, rep);
    setDashFormula_(sheet, "H" + row, dayErr, rep);
  }

  sheet.getRange("A29").setValue("По месяцам (ключ yyyy-mm, не пользователи)");
  sheet.getRange("A29").setFontWeight("bold");
  sheet
    .getRange("A30:H30")
    .setValues([
      ["Месяц", "Запуски", "Авто-проходы", "Auto applied", "Ручн. испр.", "Ручн. skip", "Choice OK", "Ошибки"],
    ]);

  var monthOpen = '=SUMPRODUCT((events!F2:F="plugin_open")*(LEFT(events!A2:A;7)={{M}}))';
  var monthAutoN = '=SUMPRODUCT((events!F2:F="auto_fix_complete")*(LEFT(events!A2:A;7)={{M}}))';
  var monthApplied =
    '=SUMPRODUCT((events!F2:F="auto_fix_complete")*(LEFT(events!A2:A;7)={{M}})*(IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""applied"":(\\d+)"));0)))';
  var monthManApp =
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;7)={{M}})*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G))))';
  var monthManSkip =
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;7)={{M}})*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))';
  var monthChoice =
    '=SUMPRODUCT((events!F2:F="choice_resolved")*(LEFT(events!A2:A;7)={{M}})*(ISNUMBER(SEARCH("""action"":""confirmed""";events!G2:G))))';
  var monthErr = '=SUMPRODUCT((events!F2:F="plugin_error")*(LEFT(events!A2:A;7)={{M}}))';

  for (var m = 0; m <= 2; m++) {
    var mRow = 31 + m;
    var mRef = "A" + mRow;
    if (m === 0) {
      setDashFormula_(sheet, mRef, '=TEXT(TODAY();"yyyy-mm")');
    } else {
      setDashFormula_(sheet, mRef, '=TEXT(EDATE(TODAY();-' + m + ');"yyyy-mm")');
    }
    var mRep = { "{{M}}": mRef };
    setDashFormula_(sheet, "B" + mRow, monthOpen, mRep);
    setDashFormula_(sheet, "C" + mRow, monthAutoN, mRep);
    setDashFormula_(sheet, "D" + mRow, monthApplied, mRep);
    setDashFormula_(sheet, "E" + mRow, monthManApp, mRep);
    setDashFormula_(sheet, "F" + mRow, monthManSkip, mRep);
    setDashFormula_(sheet, "G" + mRow, monthChoice, mRep);
    setDashFormula_(sheet, "H" + mRow, monthErr, mRep);
  }

  sheet.getRange("A39").setValue("По годам (ключ yyyy)");
  sheet.getRange("A39").setFontWeight("bold");
  sheet
    .getRange("A40:H40")
    .setValues([
      ["Год", "Запуски", "Авто-проходы", "Auto applied", "Ручн. испр.", "Ручн. skip", "Choice OK", "Ошибки"],
    ]);
  setDashFormula_(sheet, "A41", '=TEXT(TODAY();"yyyy")');
  setDashFormula_(sheet, "B41", '=SUMPRODUCT((events!F2:F="plugin_open")*(LEFT(events!A2:A;4)=A41))');
  setDashFormula_(sheet, "C41", '=SUMPRODUCT((events!F2:F="auto_fix_complete")*(LEFT(events!A2:A;4)=A41))');
  setDashFormula_(
    sheet,
    "D41",
    '=SUMPRODUCT((events!F2:F="auto_fix_complete")*(LEFT(events!A2:A;4)=A41)*(IFERROR(VALUE(REGEXEXTRACT(events!G2:G;"""applied"":(\\d+)"));0)))',
  );
  setDashFormula_(
    sheet,
    "E41",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;4)=A41)*(ISNUMBER(SEARCH("""action"":""applied""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "F41",
    '=SUMPRODUCT((events!F2:F="manual_fix_complete")*(LEFT(events!A2:A;4)=A41)*(ISNUMBER(SEARCH("""action"":""skipped""";events!G2:G))))',
  );
  setDashFormula_(
    sheet,
    "G41",
    '=SUMPRODUCT((events!F2:F="choice_resolved")*(LEFT(events!A2:A;4)=A41)*(ISNUMBER(SEARCH("""action"":""confirmed""";events!G2:G))))',
  );
  setDashFormula_(sheet, "H41", '=SUMPRODUCT((events!F2:F="plugin_error")*(LEFT(events!A2:A;4)=A41))');

  sheet.getRange("A43").setValue("Повторный запуск setupDashboard() очистит лист и соберёт заново.");
  sheet.setColumnWidth(1, 160);
  for (var c = 2; c <= 8; c++) sheet.setColumnWidth(c, 110);

  SpreadsheetApp.flush();
}
