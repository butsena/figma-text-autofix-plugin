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
// Номер реализации приёмника; это не номер версии плагина или deployment в Apps Script.
var COLLECTOR_REVISION = "T-144-1";

// Держать в соответствии с src/analytics/schema.ts. Новые поля — только по явному контракту.
var FIX_CATEGORIES = [
  "cian_branding", "cian_declension_context", "cian_editorial", "form_choice",
  "numeric_formatting", "phone_formatting", "punctuation_typography", "sheet_text",
  "text_formatting", "typography", "yo_spelling", "orthography", "other",
];
var SPELLING_SOURCES = ["suggested", "custom", "unknown"];
var ERROR_STAGES = [
  "open", "scan", "auto_apply", "manual_apply", "choice", "lexicon", "spell", "ui", "unknown",
];
var ERROR_CODES = [
  "empty_selection", "font_load_failed", "node_missing", "apply_failed",
  "lexicon_load_failed", "spell_load_failed",
  "scan_failed", "spell_init_failed", "style_restore_failed", "timeout", "unknown",
];
var ERROR_OUTCOMES = ["failed", "recovered"];
var ERROR_RESOURCES = [
  "replacements", "boundary_exceptions", "ambiguous_forms",
  "spell_dictionary", "spell_supplement", "spell_whitelist",
];
var ERROR_RECOVERIES = ["bundled", "cache"];

var EVENT_NAMES = {
  plugin_open: true,
  scan_complete: true,
  auto_fix_complete: true,
  manual_fix_complete: true,
  choice_resolved: true,
  spellcheck_requested: true,
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
    if (typeof raw !== "string" || !raw || raw.length > MAX_BODY_CHARS) {
      return jsonResponse_(400, { ok: false, error: "body" });
    }
    var body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      return jsonResponse_(400, { ok: false, error: "json" });
    }
    var validated = validateEnvelope_(body);
    if (!validated.ok) {
      return jsonResponse_(400, { ok: false, error: validated.error });
    }
    var result = appendEvent_(validated.envelope);
    return jsonResponse_(result.ok ? 200 : 409, result);
  } catch (err) {
    return jsonResponse_(500, { ok: false, error: "server" });
  }
}

/** Health-check из браузера. */
function doGet() {
  return jsonResponse_(200, {
    ok: true, service: "text-autofix-analytics", schema_version: SCHEMA_VERSION,
    collector_revision: COLLECTOR_REVISION,
    spelling_sources: SPELLING_SOURCES.slice(),
  });
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
  if (!isRecord_(body)) return { ok: false, error: "envelope" };
  if (body.schema_version !== SCHEMA_VERSION) return { ok: false, error: "schema_version" };
  if (typeof body.event !== "string" || !Object.prototype.hasOwnProperty.call(EVENT_NAMES, body.event)) {
    return { ok: false, error: "event" };
  }
  if (typeof body.session_id !== "string" || body.session_id.length < 8 || body.session_id.length > MAX_SESSION_LEN) {
    return { ok: false, error: "session_id" };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(body.session_id)) return { ok: false, error: "session_id" };
  // Старый явный smoke-маркер сохраняется; свободный текст и формулы не допускаются.
  if (typeof body.plugin_version !== "string" || body.plugin_version.length > MAX_VERSION_LEN ||
      (body.plugin_version !== "smoke" &&
       !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?(?:\+[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(body.plugin_version))) {
    return { ok: false, error: "plugin_version" };
  }
  // Клиент отправляет Date.toISOString(): проверяем также календарную дату, не только форму строки.
  if (typeof body.client_time !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.client_time) ||
      !isFinite(Date.parse(body.client_time)) || new Date(body.client_time).toISOString() !== body.client_time) {
    return { ok: false, error: "client_time" };
  }
  if (!isRecord_(body.payload)) return { ok: false, error: "payload" };

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
      // Не сохраняем исходный объект: лишние поля отбрасываются и нигде не логируются.
      payload: sanitizePayload_(body.event, body.payload),
    },
  };
}

function isRecord_(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePayload_(event, payload) {
  function intOk(v) {
    return Number.isSafeInteger(v) && v >= 0;
  }
  // Поле source разрешено только для состоявшейся орфографической замены.
  // Его наличие с неверным значением нельзя молча превращать в старую запись.
  if (Object.prototype.hasOwnProperty.call(payload, "source") &&
      (event !== "manual_fix_complete" || payload.action !== "applied" || payload.kind !== "orthography" ||
       typeof payload.source !== "string" || SPELLING_SOURCES.indexOf(payload.source) === -1)) {
    return "payload.source";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "event_id") &&
      (event !== "manual_fix_complete" || payload.action !== "applied" || payload.kind !== "orthography" ||
       typeof payload.event_id !== "string" || payload.event_id !== payload.event_id.trim() ||
       !/^evt_[A-Za-z0-9_-]{12,60}$/.test(payload.event_id))) {
    return "payload.event_id";
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
      if (payload.applied > payload.found || payload.not_applied !== payload.found - payload.applied) {
        return "payload.auto_totals";
      }
      if (!isRecord_(payload.categories)) return "payload.categories";
      var categoryKeys = Object.keys(payload.categories);
      var categoryTotal = 0;
      for (var i = 0; i < categoryKeys.length; i++) {
        var category = categoryKeys[i];
        var count = payload.categories[category];
        if (FIX_CATEGORIES.indexOf(category) === -1 || !intOk(count)) return "payload.categories";
        categoryTotal += count;
        if (categoryTotal > payload.applied) return "payload.category_total";
      }
      if (categoryTotal !== payload.applied) return "payload.category_total";
      return null;
    case "manual_fix_complete":
      if (payload.action !== "applied" && payload.action !== "skipped") return "payload.action";
      if (payload.kind !== "confirm" && payload.kind !== "orthography") return "payload.kind";
      return null;
    case "choice_resolved":
      if (payload.action !== "confirmed" && payload.action !== "skipped") return "payload.action";
      return null;
    case "spellcheck_requested":
      return null;
    case "plugin_error":
      if (ERROR_STAGES.indexOf(payload.stage) === -1) return "payload.stage";
      if (ERROR_CODES.indexOf(payload.code) === -1) return "payload.code";
      if (payload.outcome !== undefined && ERROR_OUTCOMES.indexOf(payload.outcome) === -1) return "payload.outcome";
      if (payload.resource !== undefined && ERROR_RESOURCES.indexOf(payload.resource) === -1) return "payload.resource";
      if (payload.recovery !== undefined && ERROR_RECOVERIES.indexOf(payload.recovery) === -1) return "payload.recovery";
      if (payload.outcome === undefined && (payload.resource !== undefined || payload.recovery !== undefined)) return "payload.outcome";
      if (payload.outcome === "recovered" && (payload.resource === undefined || payload.recovery === undefined ||
          (payload.stage !== "lexicon" && payload.stage !== "spell"))) return "payload.recovery";
      if (payload.outcome === "failed" && payload.recovery !== undefined) return "payload.recovery";
      if (typeof payload.resource === "string" &&
          payload.stage !== (payload.resource.indexOf("spell_") === 0 ? "spell" : "lexicon")) return "payload.resource";
      if (payload.outcome === "recovered" &&
          ((payload.resource === "spell_dictionary") !== (payload.recovery === "cache"))) return "payload.recovery";
      return null;
    default:
      return "event";
  }
}

/** Белые списки полей, включая пустой payload у spellcheck_requested. */
function sanitizePayload_(event, payload) {
  switch (event) {
    case "plugin_open":
      return { has_text_layers: payload.has_text_layers };
    case "scan_complete":
      return {
        checked_layers: payload.checked_layers, found_fixes: payload.found_fixes,
        confirm_fixes: payload.confirm_fixes, choice_fixes: payload.choice_fixes,
        duration_ms: payload.duration_ms,
      };
    case "auto_fix_complete":
      var categories = {};
      Object.keys(payload.categories).forEach(function (key) {
        if (payload.categories[key] > 0) categories[key] = payload.categories[key];
      });
      return {
        found: payload.found, applied: payload.applied, not_applied: payload.not_applied,
        duration_ms: payload.duration_ms, categories: categories,
      };
    case "manual_fix_complete":
      var manual = { action: payload.action, kind: payload.kind };
      // Не дописываем unknown историческим/старым клиентским событиям.
      if (Object.prototype.hasOwnProperty.call(payload, "source")) manual.source = payload.source;
      if (Object.prototype.hasOwnProperty.call(payload, "event_id")) manual.event_id = payload.event_id;
      return manual;
    case "choice_resolved":
      return { action: payload.action };
    case "spellcheck_requested":
      return {};
    case "plugin_error":
      var problem = { stage: payload.stage, code: payload.code };
      if (payload.outcome !== undefined) problem.outcome = payload.outcome;
      if (payload.resource !== undefined) problem.resource = payload.resource;
      if (payload.recovery !== undefined) problem.recovery = payload.recovery;
      return problem;
  }
}

/** Дополнительная защита ячеек, даже если разрешённые строки впоследствии расширят. */
function safeSheetString_(value) {
  return /^[\s\uFEFF]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
}

/** Вызывать только под ScriptLock: поиск по всей сохранённой истории, не кэшу. */
function findEventReplay_(sheet, envelope) {
  if (!Object.prototype.hasOwnProperty.call(envelope.payload, "event_id")) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var needle = '"event_id":"' + envelope.payload.event_id + '"';
  var matches = sheet.getRange(2, 7, lastRow - 1, 1).createTextFinder(needle)
    .matchCase(true).matchEntireCell(false).matchFormulaText(false).useRegularExpression(false).findAll();
  if (matches.length === 0) return null;
  var expectedPayload = JSON.stringify(envelope.payload);
  for (var i = 0; i < matches.length; i++) {
    // Версия, событие, payload_json; служебные client/server_time и session_id
    // не меняют смысл повторной доставки того же одноразового события.
    var stored = sheet.getRange(matches[i].getRow(), 5, 1, 3).getValues()[0];
    var payload;
    try {
      payload = JSON.parse(stored[2]);
    } catch (err) {
      return { ok: false, error: "event_id_conflict" };
    }
    if (stored[0] !== envelope.plugin_version || stored[1] !== envelope.event ||
        !isRecord_(payload) || validatePayload_(stored[1], payload) ||
        JSON.stringify(sanitizePayload_(stored[1], payload)) !== expectedPayload) {
      return { ok: false, error: "event_id_conflict" };
    }
  }
  return { ok: true, duplicate: true };
}

function appendEvent_(envelope) {
  // Включая прямой вызов из smokeAppend: до получения блокировки и любой записи.
  var validated = validateEnvelope_(envelope);
  if (!validated.ok) throw new Error("Invalid analytics envelope");
  envelope = validated.envelope;
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("events");
    if (!sheet) {
      onceSetup();
      sheet = ss.getSheetByName("events");
    }
    var replay = findEventReplay_(sheet, envelope);
    if (replay) return replay;
    sheet.appendRow([
      new Date().toISOString(),
      safeSheetString_(envelope.client_time),
      envelope.schema_version,
      safeSheetString_(envelope.session_id),
      safeSheetString_(envelope.plugin_version),
      safeSheetString_(envelope.event),
      safeSheetString_(JSON.stringify(envelope.payload)),
    ]);
    // Commit до releaseLock: следующий запрос должен видеть только что записанный ID.
    SpreadsheetApp.flush();
    return { ok: true };
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
  setDashFormula_(sheet, "B18", '=COUNTIF(events!F:F;"spellcheck_requested")');
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
    [18, "Проверить орфографию"],
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
  sheet.getRange("J20").setValue("Проверить орфографию");

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
  var daySpell =
    '=SUMPRODUCT((events!F2:F="spellcheck_requested")*(LEFT(events!A2:A;10)=TEXT({{DAY}};"yyyy-mm-dd")))';

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
    setDashFormula_(sheet, "J" + row, daySpell, rep);
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
