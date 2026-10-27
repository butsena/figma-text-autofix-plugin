import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_EVENT_NAMES, ANALYTICS_FIX_CATEGORIES,
  ANALYTICS_ERROR_STAGES, ANALYTICS_ERROR_CODES, buildAnalyticsEnvelope,
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
function collector({ appendFails = false, lockFails = false, existingSheet = true } = {}) {
  const rows = [];
  const appendRow = vi.fn((row) => {
    if (appendFails) throw new Error("private failure must not escape");
    rows.push(Array.from(row));
  });
  const sheet = { appendRow, getLastRow: () => 0, setFrozenRows: vi.fn() };
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
  const waitLock = vi.fn(() => { if (lockFails) throw new Error("lock unavailable"); });
  const releaseLock = vi.fn();
  const getScriptLock = vi.fn(() => ({ waitLock, releaseLock }));
  const getActiveSpreadsheet = vi.fn(() => spreadsheet);
  const scope = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet }, LockService: { getScriptLock },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(source, scope, { timeout: 1000 });
  return {
    scope, rows, appendRow, spreadsheet, getActiveSpreadsheet, getScriptLock, waitLock, releaseLock,
    postRaw: (raw) => JSON.parse(scope.doPost({ postData: { contents: raw } }).text),
    post(body) { return this.postRaw(JSON.stringify(body)); },
  };
}

describe("Apps Script collector: совместимость schema v1", () => {
  it("не расходится с закрытыми списками клиента", () => {
    const { scope } = collector();
    expect(Object.keys(scope.EVENT_NAMES)).toEqual([...ANALYTICS_EVENT_NAMES]);
    expect(Array.from(scope.FIX_CATEGORIES)).toEqual([...ANALYTICS_FIX_CATEGORIES]);
    expect(Array.from(scope.ERROR_STAGES)).toEqual([...ANALYTICS_ERROR_STAGES]);
    expect(Array.from(scope.ERROR_CODES)).toEqual([...ANALYTICS_ERROR_CODES]);
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
    expect(c.rows[0]).toEqual(["server_time", "client_time", "schema_version", "session_id", "plugin_version", "event", "payload_json"]);
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
      ok: true, service: "text-autofix-analytics", schema_version: 1, collector_revision: "T-140-1",
    });
    expect(c.getActiveSpreadsheet).not.toHaveBeenCalled();
  });
});
