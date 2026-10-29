import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_EVENT_NAMES, ANALYTICS_FIX_CATEGORIES, ANALYTICS_SPELLING_SOURCES,
  ANALYTICS_ERROR_STAGES, ANALYTICS_ERROR_CODES, ANALYTICS_ERROR_OUTCOMES,
  ANALYTICS_ERROR_RESOURCES, ANALYTICS_ERROR_RECOVERIES, buildAnalyticsEnvelope,
} from "./schema";

const source = readFileSync(new URL("../../scripts/analytics-apps-script.js", import.meta.url), "utf8");
const payloads = {
  plugin_open: { has_text_layers: true },
  // found_fixes — auto, а не сумма auto/confirm/choice.
  scan_complete: { checked_layers: 1, found_fixes: 0, confirm_fixes: 2, choice_fixes: 3, duration_ms: 10 },
  auto_fix_complete: { found: 4, applied: 3, not_applied: 1, duration_ms: 20, categories: { typography: 2, other: 1 } },
  manual_fix_complete: { action: "applied", kind: "orthography" },
  choice_resolved: { action: "confirmed" },
  spellcheck_requested: {},
  plugin_error: { stage: "manual_apply", code: "apply_failed" },
};
function envelope(event = "plugin_open", payload = payloads[event]) {
  return {
    schema_version: 1, client_time: "2026-10-23T12:00:00.000Z",
    session_id: "sess_fixture01", plugin_version: "0.22.0", event, payload,
  };
}

// Все сервисы локальные. Ни рабочая таблица, ни сеть здесь недоступны.
function collector({ appendFails = false, lockFails = false, existingSheet = true, flushFailsOnce = false, headers } = {}) {
  const rows = [];
  const searches = [];
  const trace = [];
  let held = false;
  // В существующем листе заголовок есть, но rows хранит только новые записи.
  const headerRows = existingSheet ? 1 : 0;
  function storedRow(row) { return headerRows && row === 1 ? (headers ?? Array.from(scope.EVENT_HEADERS)) : rows[row - 1 - headerRows]; }
  const appendRow = vi.fn((row) => {
    if (appendFails) throw new Error("private failure must not escape");
    trace.push("append");
    rows.push(Array.from(row));
  });
  const getRange = vi.fn((row, column, numRows, numColumns) => {
    if (!held) throw new Error("Range access must be inside ScriptLock");
    trace.push("range");
    return {
      getValues: () => Array.from({ length: numRows }, (_, i) =>
        storedRow(row + i).slice(column - 1, column - 1 + numColumns)),
      createTextFinder(needle) {
        const search = { row, column, numRows, numColumns, needle, options: {} };
        searches.push(search);
        const finder = {
          matchCase(value) { search.options.matchCase = value; return this; },
          matchEntireCell(value) { search.options.matchEntireCell = value; return this; },
          matchFormulaText(value) { search.options.matchFormulaText = value; return this; },
          useRegularExpression(value) { search.options.useRegularExpression = value; return this; },
          findAll() {
            if (!held) throw new Error("Search must be inside ScriptLock");
            trace.push("search");
            const matches = [];
            for (let i = 0; i < numRows; i++) {
              if (String(storedRow(row + i)?.[column - 1] ?? "").includes(needle)) {
                matches.push({ getRow: () => row + i });
              }
            }
            return matches;
          },
        };
        return finder;
      },
    };
  });
  const sheet = { appendRow, getLastRow: () => rows.length + headerRows, getRange, setFrozenRows: vi.fn() };
  let present = existingSheet;
  const spreadsheet = {
    getSheetByName: vi.fn((name) => {
      if (name !== "events") throw new Error("Unexpected sheet access");
      return present ? sheet : null;
    }),
    insertSheet: vi.fn((name) => {
      if (name !== "events") throw new Error("Unexpected sheet creation");
      present = true;
      return sheet;
    }),
  };
  const waitLock = vi.fn(() => {
    if (lockFails) throw new Error("lock unavailable");
    if (held) throw new Error("Lock already held");
    held = true;
    trace.push("lock");
  });
  const releaseLock = vi.fn(() => { trace.push("release"); held = false; });
  const getScriptLock = vi.fn(() => ({ waitLock, releaseLock }));
  const getActiveSpreadsheet = vi.fn(() => spreadsheet);
  const flush = vi.fn(() => {
    if (!held) throw new Error("Flush must be inside ScriptLock");
    trace.push("flush");
    if (flushFailsOnce) {
      flushFailsOnce = false;
      throw new Error("private failure after append");
    }
  });
  const scope = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet, flush }, LockService: { getScriptLock },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(source, scope, { timeout: 1000 });
  return {
    scope, rows, searches, trace, getRange, appendRow, flush, spreadsheet, getActiveSpreadsheet, getScriptLock, waitLock, releaseLock,
    postRaw: (raw) => JSON.parse(scope.doPost({ postData: { contents: raw } }).text),
    post(body) { return this.postRaw(JSON.stringify(body)); },
  };
}

describe("Apps Script collector: совместимость schema v1", () => {
  it("не расходится с закрытыми списками клиента", () => {
    const { scope } = collector();
    expect(Object.keys(scope.EVENT_NAMES)).toEqual([...ANALYTICS_EVENT_NAMES]);
    expect(Array.from(scope.FIX_CATEGORIES)).toEqual([...ANALYTICS_FIX_CATEGORIES]);
    expect(Array.from(scope.SPELLING_SOURCES)).toEqual([...ANALYTICS_SPELLING_SOURCES]);
    expect(Array.from(scope.ERROR_STAGES)).toEqual([...ANALYTICS_ERROR_STAGES]);
    expect(Array.from(scope.ERROR_CODES)).toEqual([...ANALYTICS_ERROR_CODES]);
    expect(Array.from(scope.ERROR_OUTCOMES)).toEqual([...ANALYTICS_ERROR_OUTCOMES]);
    expect(Array.from(scope.ERROR_RESOURCES)).toEqual([...ANALYTICS_ERROR_RESOURCES]);
    expect(Array.from(scope.ERROR_RECOVERIES)).toEqual([...ANALYTICS_ERROR_RECOVERIES]);
  });

  it.each(ANALYTICS_EVENT_NAMES)("принимает клиентское событие %s без изменения смысла", (event) => {
    const c = collector();
    const built = buildAnalyticsEnvelope({
      event, payload: payloads[event], sessionId: "sess_fixture01",
      pluginVersion: "0.22.0", clientTime: "2026-10-23T12:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    expect(c.post(built.envelope)).toEqual({ ok: true });
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0].slice(1, 6)).toEqual([
      built.envelope.client_time, 1, built.envelope.session_id, "0.22.0", event,
    ]);
    expect(JSON.parse(c.rows[0][6])).toEqual(built.envelope.payload);
    expect(c.waitLock).toHaveBeenCalledWith(5000);
    expect(c.releaseLock).toHaveBeenCalledTimes(1);
  });

  it.each(["0.18.0", "0.22.0", "smoke", "0.22.0-smoke", "0.22.0-test-build-tag", "0.22.0+build.1"])(
    "сохраняет совместимую версию %s", (plugin_version) => {
      expect(collector().post({ ...envelope(), plugin_version })).toEqual({ ok: true });
    },
  );

  it("принимает дельту auto после ручного действия", () => {
    const c = collector();
    const payload = {
      found: 3, applied: 1, not_applied: 2, duration_ms: 15, categories: { typography: 1 },
    };
    expect(c.post(envelope("auto_fix_complete", payload))).toEqual({ ok: true });
    expect(JSON.parse(c.rows[0][6])).toEqual(payload);
  });

  it.each(ANALYTICS_SPELLING_SOURCES)("принимает клиентский источник %s без потери поля", (source) => {
    const c = collector();
    const built = buildAnalyticsEnvelope({
      event: "manual_fix_complete", payload: { action: "applied", kind: "orthography", source },
      sessionId: "sess_fixture01", pluginVersion: "0.22.0", clientTime: "2026-10-27T12:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    expect(c.post(built.envelope)).toEqual({ ok: true });
    expect(c.rows[0]).toHaveLength(8);
    expect(JSON.parse(c.rows[0][6])).toEqual({ action: "applied", kind: "orthography", source });
  });

  it("не дописывает unknown старым событиям без source", () => {
    const c = collector();
    for (const action of ["applied", "skipped"]) for (const kind of ["confirm", "orthography"]) {
      expect(c.post(envelope("manual_fix_complete", { action, kind }))).toEqual({ ok: true });
      expect(JSON.parse(c.rows.at(-1)[6])).toEqual({ action, kind });
    }
  });

  it("повторная доставка одного event_id даёт одну строку, поиск и запись под одной блокировкой", () => {
    const c = collector();
    const payload = { action: "applied", kind: "orthography", source: "suggested", event_id: "evt_123456789012" };
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: true });
    // Порядок JSON-полей и служебное время доставки не меняют содержимое события.
    expect(c.post({
      ...envelope("manual_fix_complete", {
        event_id: payload.event_id, source: "suggested", kind: "orthography", action: "applied",
        before: "PRIVATE_TEXT",
      }), client_time: "2026-10-27T12:00:00.000Z",
    })).toEqual({ ok: true, duplicate: true });
    expect(c.rows).toHaveLength(1);
    expect(JSON.parse(c.rows[0][6])).toEqual(payload);
    expect(c.trace).toEqual(["lock", "range", "append", "flush", "release", "lock", "range", "range", "search", "range", "release"]);
    expect(c.searches[0]).toEqual({
      row: 2, column: 7, numRows: 1, numColumns: 1, needle: '"event_id":"evt_123456789012"',
      options: { matchCase: true, matchEntireCell: false, matchFormulaText: false, useRegularExpression: false },
    });
    expect(c.releaseLock).toHaveBeenCalledTimes(2);
  });

  it("повтор после ошибки ответа/flush не дублирует уже сохранённый ID", () => {
    const c = collector({ flushFailsOnce: true });
    const payload = { action: "applied", kind: "orthography", source: "custom", event_id: "evt_123456789012" };
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: false, error: "server" });
    expect(c.rows).toHaveLength(1);
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: true, duplicate: true });
    expect(c.rows).toHaveLength(1);
    expect(c.releaseLock).toHaveBeenCalledTimes(2);
  });

  it("разные event_id сохраняют две одинаковые по смыслу правки", () => {
    const c = collector();
    for (const event_id of ["evt_123456789012", "evt_123456789013"]) {
      expect(c.post(envelope("manual_fix_complete", {
        action: "applied", kind: "orthography", source: "custom", event_id,
      }))).toEqual({ ok: true });
    }
    expect(c.rows).toHaveLength(2);
  });

  it.each([
    { source: "custom" },
    { source: "unknown" },
    { plugin_version: "0.23.0" },
  ])("отклоняет конфликт event_id без второй строки: %j", (change) => {
    const c = collector();
    const payload = { action: "applied", kind: "orthography", source: "suggested", event_id: "evt_123456789012" };
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: true });
    const body = change.plugin_version ?
      { ...envelope("manual_fix_complete", payload), plugin_version: change.plugin_version } :
      envelope("manual_fix_complete", { ...payload, ...change });
    expect(c.post(body)).toEqual({ ok: false, error: "event_id_conflict" });
    expect(c.rows).toHaveLength(1);
    expect(c.releaseLock).toHaveBeenCalledTimes(2);
  });

  it("сравнивает событие сохранённого ID и ищет по всей истории, включая старые строки", () => {
    const c = collector();
    const payload = { action: "applied", kind: "orthography", source: "unknown", event_id: "evt_123456789012" };
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: true });
    const oldRow = [...c.rows[0]];
    for (let i = 0; i < 1001; i++) c.rows.push([...oldRow.slice(0, 6), JSON.stringify({ action: "applied", kind: "orthography" })]);
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: true, duplicate: true });
    expect(c.searches.at(-1).numRows).toBe(1002);
    c.rows[0][5] = "choice_resolved";
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: false, error: "event_id_conflict" });
    expect(c.rows).toHaveLength(1002);
  });

  it("не применяет дедупликацию к legacy без event_id", () => {
    const c = collector();
    const body = envelope("manual_fix_complete");
    expect(c.post(body)).toEqual({ ok: true });
    expect(c.post(body)).toEqual({ ok: true });
    expect(c.rows).toHaveLength(2);
    expect(c.searches).toHaveLength(0);
  });

  it("принимает нулевой auto и все разрешённые категории", () => {
    const c = collector();
    expect(c.post(envelope("auto_fix_complete", {
      found: 0, applied: 0, not_applied: 0, duration_ms: 0, categories: {},
    }))).toEqual({ ok: true });
    const categories = Object.fromEntries(ANALYTICS_FIX_CATEGORIES.map((name) => [name, 1]));
    expect(c.post(envelope("auto_fix_complete", {
      found: ANALYTICS_FIX_CATEGORIES.length, applied: ANALYTICS_FIX_CATEGORIES.length,
      not_applied: 0, duration_ms: 0, categories,
    }))).toEqual({ ok: true });
    expect(JSON.parse(c.rows[1][6]).categories).toEqual(categories);
  });

  it("принимает все разрешённые действия, этапы и коды", () => {
    const c = collector();
    for (const action of ["applied", "skipped"]) for (const kind of ["confirm", "orthography"]) {
      expect(c.post(envelope("manual_fix_complete", { action, kind }))).toEqual({ ok: true });
    }
    for (const action of ["confirmed", "skipped"]) {
      expect(c.post(envelope("choice_resolved", { action }))).toEqual({ ok: true });
    }
    for (const stage of ANALYTICS_ERROR_STAGES) for (const code of ANALYTICS_ERROR_CODES) {
      expect(c.post(envelope("plugin_error", { stage, code }))).toEqual({ ok: true });
    }
  });
});

describe("Apps Script collector: граница приватности и корректности", () => {
  it.each(ANALYTICS_SPELLING_SOURCES)("сохраняет источник %s, но отбрасывает приватные поля", (source) => {
    const c = collector();
    const payload = {
      action: "applied", kind: "orthography", source,
      before: "PRIVATE_TEXT", after: "PRIVATE_TEXT", sourceText: "PRIVATE_TEXT",
      candidate: "PRIVATE_TEXT", extra: { nodeId: "PRIVATE_TEXT" },
    };
    expect(c.post(envelope("manual_fix_complete", payload))).toEqual({ ok: true });
    expect(JSON.parse(c.rows[0][6])).toEqual({ action: "applied", kind: "orthography", source });
    expect(JSON.stringify(c.rows)).not.toContain("PRIVATE_TEXT");
  });

  it.each(ANALYTICS_EVENT_NAMES)("не сохраняет лишние/защищённые поля в %s", (event) => {
    const c = collector();
    const body = {
      ...envelope(event), before: "PRIVATE_TEXT", userId: "PRIVATE_TEXT",
      payload: {
        ...payloads[event], before: "PRIVATE_TEXT", after: "PRIVATE_TEXT", sourceText: "PRIVATE_TEXT",
        nodeId: "PRIVATE_TEXT", fileKey: "PRIVATE_TEXT", email: "PRIVATE_TEXT",
        message: "PRIVATE_TEXT", stack: "PRIVATE_TEXT", extra: { hint: "PRIVATE_TEXT" },
      },
    };
    expect(c.post(body)).toEqual({ ok: true });
    expect(JSON.stringify(c.rows)).not.toContain("PRIVATE_TEXT");
    expect(JSON.parse(c.rows[0][6])).toEqual(payloads[event]);
    expect(Object.keys(c.scope.validateEnvelope_(body).envelope)).toEqual([
      "client_time", "schema_version", "session_id", "plugin_version", "event", "payload",
    ]);
  });

  const invalid = [
    null, [], false, "free text", 1,
    { ...envelope(), schema_version: "1" }, { ...envelope(), schema_version: 2 },
    ...["constructor", "toString", "__proto__", "new_event", 1].map((event) => ({ ...envelope(), event })),
    ...["short", "x".repeat(65), "sess email", "=IMPORTXML(1)", null, 123].map((session_id) => ({ ...envelope(), session_id })),
    ...["", " ", "x".repeat(33), "=1+1", "+SUM(1)", "\t=1+1", "private words", "0.22.0\n", null].map((plugin_version) => ({ ...envelope(), plugin_version })),
    ...["", "=1+1", "2026-02-30T12:00:00.000Z", "2026-10-23", "2026-13-01T00:00:00.000Z", "2026-10-23T24:00:00.000Z", "2026-10-23T12:00:00.000Z\n", null, 123].map((client_time) => ({ ...envelope(), client_time })),
    ...[null, [], "PRIVATE_TEXT", 42].map((payload) => envelope("spellcheck_requested", payload)),
    envelope("plugin_open", {}), envelope("plugin_open", { has_text_layers: "true" }),
    envelope("manual_fix_complete", { action: "confirmed", kind: "confirm" }),
    envelope("manual_fix_complete", { action: "applied", kind: "PRIVATE_TEXT" }),
    ...["PRIVATE_TEXT", "Suggested", "", null, 1, {}, []].map((source) =>
      envelope("manual_fix_complete", { action: "applied", kind: "orthography", source })),
    ...["applied", "skipped"].flatMap((action) => ["confirm", "orthography"].flatMap((kind) =>
      action === "applied" && kind === "orthography" ? [] :
        ANALYTICS_SPELLING_SOURCES.map((source) => envelope("manual_fix_complete", { action, kind, source })))),
    ...ANALYTICS_EVENT_NAMES.filter((event) => event !== "manual_fix_complete").map((event) =>
      envelope(event, { ...payloads[event], source: "unknown" })),
    ...["", "evt_" + "a".repeat(11), "evt_" + "a".repeat(61), "PRIVATE_TEXT", "evt_PRIVATE TEXT", "evt_123456789012\n", null, 1, {}].map((event_id) =>
      envelope("manual_fix_complete", { action: "applied", kind: "orthography", source: "custom", event_id })),
    ...["applied", "skipped"].flatMap((action) => ["confirm", "orthography"].flatMap((kind) =>
      action === "applied" && kind === "orthography" ? [] :
        [envelope("manual_fix_complete", { action, kind, event_id: "evt_123456789012" })])),
    ...ANALYTICS_EVENT_NAMES.filter((event) => event !== "manual_fix_complete").map((event) =>
      envelope(event, { ...payloads[event], event_id: "evt_123456789012" })),
    envelope("choice_resolved", { action: "applied" }),
    envelope("plugin_error", { stage: "PRIVATE_TEXT", code: "unknown" }),
    envelope("plugin_error", { stage: "scan", code: "PRIVATE_TEXT" }),
    envelope("plugin_error", { stage: {}, code: "unknown" }),
    ...[true, "1", -1, 0.5, null, Number.MAX_SAFE_INTEGER + 1].map((n) => envelope("scan_complete", { ...payloads.scan_complete, checked_layers: n })),
    envelope("auto_fix_complete", { ...payloads.auto_fix_complete, found: 2 }),
    envelope("auto_fix_complete", { ...payloads.auto_fix_complete, not_applied: 0 }),
    ...[[], null, "PRIVATE_TEXT", { private_category: 3 }, { constructor: 3 }, { typography: "3" }, { typography: -3 }, { typography: 2.5 }, { typography: 2 }, { typography: 4 }].map((categories) => envelope("auto_fix_complete", { ...payloads.auto_fix_complete, categories })),
  ];
  it.each(invalid.map((body, index) => [index, body]))("отклоняет неверный ввод #%s без доступа к таблице", (_, body) => {
    const c = collector();
    const result = c.post(body);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_TEXT");
    expect(c.getActiveSpreadsheet).not.toHaveBeenCalled();
    expect(c.getScriptLock).not.toHaveBeenCalled();
    expect(c.rows).toHaveLength(0);
  });

  it("проверяет каждый числовой показатель, включая небезопасные/бесконечные числа", () => {
    const c = collector();
    for (const event of ["scan_complete", "auto_fix_complete"]) {
      for (const key of Object.keys(payloads[event]).filter((key) => key !== "categories")) {
        for (const value of ["1", -1, 0.5, null, true, Number.MAX_SAFE_INTEGER + 1]) {
          expect(c.post(envelope(event, { ...payloads[event], [key]: value })).ok).toBe(false);
        }
      }
    }
    expect(c.postRaw(JSON.stringify(envelope("scan_complete")).replace('"duration_ms":10', '"duration_ms":1e400')).ok).toBe(false);
    expect(c.rows).toHaveLength(0);
  });

  it("не трактует ключи прототипа как разрешённые категории или поля", () => {
    const c = collector();
    const raw = JSON.stringify(envelope("auto_fix_complete")).replace('"categories":{"typography":2,"other":1}', '"categories":{"__proto__":3}');
    expect(c.postRaw(raw).ok).toBe(false);
    const extra = JSON.stringify(envelope()).replace('"payload":{', '"__proto__":{"private":"PRIVATE_TEXT"},"payload":{"__proto__":{"private":"PRIVATE_TEXT"},');
    expect(c.postRaw(extra)).toEqual({ ok: true });
    expect(JSON.stringify(c.rows)).not.toContain("PRIVATE_TEXT");
    expect({}.private).toBeUndefined();
  });

  it("проверяет длины и тело до JSON/таблицы", () => {
    const c = collector();
    const raw = JSON.stringify(envelope());
    expect(c.postRaw(raw.padEnd(4000, " "))).toEqual({ ok: true });
    expect(c.postRaw(raw.padEnd(4001, " "))).toEqual({ ok: false, error: "body" });
    for (const input of ["", 4, [], {}]) expect(c.postRaw(input).ok).toBe(false);
    expect(c.postRaw("{private malformed json")).toEqual({ ok: false, error: "json" });
    expect(c.post({ ...envelope(), session_id: "a".repeat(8) })).toEqual({ ok: true });
    expect(c.post({ ...envelope(), session_id: "a".repeat(64) })).toEqual({ ok: true });
    expect(c.post({ ...envelope(), plugin_version: "0.22.0-" + "a".repeat(25) })).toEqual({ ok: true });
    expect(c.post({ ...envelope(), plugin_version: "0.22.0-" + "a".repeat(26) }).ok).toBe(false);
    expect(c.rows).toHaveLength(4);
  });

  it("не переносит формульное начало в ячейки; ID сохраняется как литерал", () => {
    const c = collector();
    expect(c.post({ ...envelope(), session_id: "-sess_fixture01" })).toEqual({ ok: true });
    expect(c.rows[0][3]).toBe("'-sess_fixture01");
    for (const value of ["=1+1", "+1", "-1", "@SUM(1)", "\t=1+1", "\n=1", " \r=1"]) {
      expect(c.scope.safeSheetString_(value)).toBe("'" + value);
    }
    for (const row of c.rows) expect(row.every((v) => typeof v !== "string" || !v.startsWith("="))).toBe(true);
  });

  it("повторно защищает прямую запись и инициализирует только events при необходимости", () => {
    const c = collector({ existingSheet: false });
    expect(() => c.scope.appendEvent_({ ...envelope(), client_time: "=1+1" })).toThrow();
    expect(c.getActiveSpreadsheet).not.toHaveBeenCalled();
    expect(c.post(envelope())).toEqual({ ok: true });
    expect(c.spreadsheet.insertSheet).toHaveBeenCalledExactlyOnceWith("events");
    expect(c.rows).toHaveLength(2); // прежний заголовок + целая запись; других листов нет
    expect(c.rows[0]).toEqual(["server_time", "client_time", "schema_version", "session_id", "plugin_version", "event", "payload_json", "traffic_mode"]);
  });

  it("ошибка хранилища освобождает блокировку и не раскрывает исключение", () => {
    const c = collector({ appendFails: true });
    expect(c.post(envelope())).toEqual({ ok: false, error: "server" });
    expect(c.releaseLock).toHaveBeenCalledTimes(1);
    expect(c.rows).toHaveLength(0);
  });

  it("ошибка блокировки не начинает запись", () => {
    const c = collector({ lockFails: true });
    expect(c.post(envelope())).toEqual({ ok: false, error: "server" });
    expect(c.getActiveSpreadsheet).not.toHaveBeenCalled();
    expect(c.releaseLock).not.toHaveBeenCalled();
  });

  it("health-check показывает реализацию, но не доказывает её публикацию", () => {
    const c = collector();
    expect(JSON.parse(c.scope.doGet().text)).toEqual({
      ok: true, service: "text-autofix-analytics", schema_version: 1, collector_revision: "T-151-1",
      traffic_modes: ["production", "test"], traffic_mode_storage: "events!H",
      spelling_sources: ["suggested", "custom", "unknown"],
    });
    expect(c.getActiveSpreadsheet).not.toHaveBeenCalled();
  });
});


describe("T-144: error outcome roundtrip", () => {
  const modern = [
    ...["font_load_failed", "apply_failed", "style_restore_failed"].map(code => ({ stage: "manual_apply", code, outcome: "failed" })),
    { stage: "scan", code: "scan_failed", outcome: "failed" },
    { stage: "spell", code: "spell_init_failed", outcome: "failed", resource: "spell_dictionary" },
    ...ANALYTICS_ERROR_RESOURCES.map(resource => ({
      stage: resource.startsWith("spell_") ? "spell" : "lexicon",
      code: resource.startsWith("spell_") ? "spell_load_failed" : "lexicon_load_failed",
      outcome: "recovered", resource, recovery: resource === "spell_dictionary" ? "cache" : "bundled",
    })),
  ];
  it.each(modern)("preserves safe client metadata %j", payload => {
    const c = collector();
    const built = buildAnalyticsEnvelope({ event: "plugin_error", payload, sessionId: "sess_fixture01", pluginVersion: "smoke" });
    expect(built.ok).toBe(true);
    expect(c.post({ ...built.envelope, payload: { ...payload, message: "PRIVATE", stack: "PRIVATE", fileKey: "PRIVATE" } })).toEqual({ ok: true });
    expect(JSON.parse(c.rows[0][6])).toEqual(payload);
    expect(JSON.stringify(c.rows)).not.toContain("PRIVATE");
  });
  it.each([
    { outcome: null }, { outcome: "PRIVATE" }, { outcome: "recovered" },
    { resource: "PRIVATE", outcome: "failed" }, { recovery: "cache" },
    { outcome: "failed", recovery: "cache" },
    { outcome: "recovered", resource: "replacements", recovery: "cache" },
    { outcome: "recovered", resource: "spell_dictionary", recovery: "bundled" },
    { stage: "manual_apply", outcome: "recovered", resource: "spell_dictionary", recovery: "cache" },
  ])("rejects bad metadata before storage %j", extra => {
    const payload = { stage: "spell", code: "spell_load_failed", ...extra };
    const c = collector();
    expect(c.post(envelope("plugin_error", payload)).ok).toBe(false);
    expect(c.rows).toHaveLength(0);
    expect(buildAnalyticsEnvelope({ event: "plugin_error", payload, sessionId: "sess_fixture01", pluginVersion: "smoke" }).ok).toBe(false);
  });
  it("never adds a modern outcome to old records", () => {
    const c = collector();
    c.post(envelope("plugin_error", { stage: "ui", code: "unknown" }));
    expect(JSON.parse(c.rows[0][6])).toEqual({ stage: "ui", code: "unknown" });
  });
});

describe("T-151: explicit traffic mode and compatible storage", () => {
  it.each(ANALYTICS_EVENT_NAMES)("roundtrips both modes for %s", event => {
    for (const trafficMode of ["production", "test"]) {
      const built = buildAnalyticsEnvelope({ event, payload: payloads[event], sessionId: "sess_fixture01", pluginVersion: "0.23.0", trafficMode });
      expect(built.ok).toBe(true);
      const c = collector();
      expect(c.post(built.envelope)).toEqual({ ok: true });
      expect(c.rows[0][7]).toBe(trafficMode);
      expect(c.rows[0].slice(1, 7)).toEqual([built.envelope.client_time, 1, "sess_fixture01", "0.23.0", event, JSON.stringify(built.envelope.payload)]);
    }
  });
  it.each([null, "", "unknown", "Production", " test", 1, {}, []])("rejects explicit bad mode %j before storage", trafficMode => {
    const c = collector();
    expect(c.post({ ...envelope(), traffic_mode: trafficMode })).toEqual({ ok: false, error: "traffic_mode" });
    expect(c.getActiveSpreadsheet).not.toHaveBeenCalled();
    expect(buildAnalyticsEnvelope({ event: "plugin_open", payload: payloads.plugin_open, sessionId: "sess_fixture01", pluginVersion: "0.23.0", trafficMode }).ok).toBe(false);
  });
  it("stores legacy as unknown; does not infer a mode from a version suffix", () => {
    const c = collector();
    for (const version of ["0.18.0", "0.23.0-qa", "smoke"]) c.post({ ...envelope(), plugin_version: version });
    expect(c.rows.map(r => r[7])).toEqual(["unknown", "unknown", "unknown"]);
    expect(c.rows.map(r => r[4])).toEqual(["0.18.0", "0.23.0-qa", "smoke"]);
  });
  it("rejects smoke+production, allows smoke+test", () => {
    const c = collector();
    expect(c.post({ ...envelope(), plugin_version: "smoke", traffic_mode: "production" }).ok).toBe(false);
    expect(c.post({ ...envelope(), plugin_version: "smoke", traffic_mode: "test" })).toEqual({ ok: true });
    expect(c.rows).toHaveLength(1);
  });
  it("mode participates in replay identity; legacy empty storage normalizes to unknown", () => {
    const c = collector();
    const e = envelope("manual_fix_complete", { action: "applied", kind: "orthography", source: "custom", event_id: "evt_t151fixture0001" });
    expect(c.post(e)).toEqual({ ok: true });
    c.rows[0][7] = ""; // previously stored A:G, H still blank
    expect(c.post(e)).toEqual({ ok: true, duplicate: true });
    expect(c.post({ ...e, traffic_mode: "production" })).toEqual({ ok: false, error: "event_id_conflict" });
    expect(c.rows).toHaveLength(1);
    const test = { ...e, traffic_mode: "test", payload: { ...e.payload, event_id: "evt_t151fixture0002" } };
    expect(c.post(test)).toEqual({ ok: true });
    expect(c.post(test)).toEqual({ ok: true, duplicate: true });
    expect(c.post({ ...test, traffic_mode: "production" })).toEqual({ ok: false, error: "event_id_conflict" });
    expect(c.rows).toHaveLength(2);
  });
  it("does not overwrite an unmigrated or occupied header", () => {
    const c = collector({ headers: ["server_time", "client_time", "schema_version", "session_id", "plugin_version", "event", "payload_json", "OTHER"] });
    expect(c.post(envelope())).toEqual({ ok: false, error: "server" });
    expect(c.rows).toHaveLength(0);
    expect(c.releaseLock).toHaveBeenCalled();
  });
  it("smokeAppend writes an explicit test, not unmarked work", () => {
    const c = collector();
    c.scope.smokeAppend();
    expect(c.rows[0][7]).toBe("test");
    expect(c.rows[0][4]).toBe("0.0.0-collector-test");
  });
});
