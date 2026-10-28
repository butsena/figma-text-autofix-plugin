import { describe, expect, it } from "vitest";
import {
  ANALYTICS_FORBIDDEN_KEYS,
  ANALYTICS_SCHEMA_VERSION,
  ANALYTICS_SPELLING_SOURCES,
  aggregateAnalyticsCategories,
  buildAnalyticsEnvelope,
  mapRuleCategoryToAnalytics,
  serializeAnalyticsEnvelope,
  type AnalyticsEnvelope,
} from "./schema";

describe("analytics schema v1", () => {
  it("собирает plugin_open без лишних полей", () => {
    const built = buildAnalyticsEnvelope({
      event: "plugin_open",
      payload: { has_text_layers: true },
      sessionId: "sess_abc12345",
      pluginVersion: "0.1.0",
      clientTime: "2026-10-07T12:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.schema_version).toBe(ANALYTICS_SCHEMA_VERSION);
    expect(built.envelope.payload).toEqual({ has_text_layers: true });
    expect(JSON.stringify(built.envelope)).not.toMatch(/nodeName|sourceText|stack/);
  });

  it("auto_fix_complete хранит found/applied/not_applied/duration_ms и категории", () => {
    const built = buildAnalyticsEnvelope({
      event: "auto_fix_complete",
      payload: {
        found: 4,
        applied: 3,
        not_applied: 1,
        duration_ms: 120,
        categories: { typography: 2, cian_branding: 1 },
      },
      sessionId: "sess_abc12345",
      pluginVersion: "0.1.0",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.payload).toEqual({
      found: 4,
      applied: 3,
      not_applied: 1,
      duration_ms: 120,
      categories: { typography: 2, cian_branding: 1 },
    });
  });

  it("срезает неизвестные ключи из payload и не пускает запрещённые", () => {
    const dirty = {
      event: "manual_fix_complete" as const,
      schema_version: 1 as const,
      client_time: "2026-10-07T12:00:00.000Z",
      session_id: "sess_abc12345",
      plugin_version: "0.1.0",
      payload: {
        action: "applied" as const,
        kind: "confirm" as const,
        before: "ЦИАН",
        after: "Циан",
        nodeName: "Лид",
      },
    };
    const json = serializeAnalyticsEnvelope(dirty as AnalyticsEnvelope);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json!);
    expect(parsed.payload).toEqual({ action: "applied", kind: "confirm" });
    for (const key of ["before", "after", "nodeName"]) {
      expect(parsed.payload).not.toHaveProperty(key);
    }
  });

  it("отклоняет plugin_error со свободным message/stack", () => {
    const built = buildAnalyticsEnvelope({
      event: "plugin_error",
      // @ts-expect-error намеренно лишние поля
      payload: {
        stage: "scan",
        code: "unknown",
        message: "Font missing for Inter",
        stack: "Error: at apply",
      },
      sessionId: "sess_abc12345",
      pluginVersion: "0.1.0",
    });
    // sanitize оставляет только stage/code; forbidden check на envelope после sanitize
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.payload).toEqual({ stage: "scan", code: "unknown" });
    expect(JSON.stringify(built.envelope)).not.toContain("Font missing");
    expect(JSON.stringify(built.envelope)).not.toContain("at apply");
  });

  it("отклоняет короткий session_id и неизвестный event payload", () => {
    expect(
      buildAnalyticsEnvelope({
        event: "choice_resolved",
        payload: { action: "confirmed" },
        sessionId: "short",
        pluginVersion: "0.1.0",
      }).ok,
    ).toBe(false);

    expect(
      buildAnalyticsEnvelope({
        event: "choice_resolved",
        // @ts-expect-error
        payload: { action: "maybe" },
        sessionId: "sess_abc12345",
        pluginVersion: "0.1.0",
      }).ok,
    ).toBe(false);
  });

  it("spellcheck_requested сериализуется пустым payload", () => {
    const built = buildAnalyticsEnvelope({
      event: "spellcheck_requested",
      payload: {},
      sessionId: "sess_abc12345",
      pluginVersion: "0.18.0",
      clientTime: "2026-10-21T12:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.event).toBe("spellcheck_requested");
    expect(built.envelope.payload).toEqual({});
  });

  it.each(ANALYTICS_SPELLING_SOURCES)("сохраняет источник %s только как enum", (source) => {
    const built = buildAnalyticsEnvelope({
      event: "manual_fix_complete",
      payload: { action: "applied", kind: "orthography", source },
      sessionId: "sess_abc12345", pluginVersion: "0.22.0",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(JSON.parse(serializeAnalyticsEnvelope(built.envelope)!).payload).toEqual({
      action: "applied", kind: "orthography", source,
    });
  });

  it("не дописывает source старому клиенту и не меняет его семантику", () => {
    for (const action of ["applied", "skipped"] as const) {
      for (const kind of ["orthography", "confirm"] as const) {
        const built = buildAnalyticsEnvelope({
          event: "manual_fix_complete", payload: { action, kind },
          sessionId: "sess_abc12345", pluginVersion: "0.18.0",
        });
        expect(built.ok).toBe(true);
        if (!built.ok) continue;
        expect(built.envelope.payload).toEqual({ action, kind });
        expect(JSON.parse(serializeAnalyticsEnvelope(built.envelope)!).payload).not.toHaveProperty("source");
      }
    }
  });

  it.each(["PRIVATE_TEXT", "Suggested", "", null, 1, {}, [], undefined])(
    "отклоняет неверный источник #%s, не превращая его в legacy", (source) => {
      const built = buildAnalyticsEnvelope({
        event: "manual_fix_complete",
        // @ts-expect-error проверка недоверенных данных
        payload: { action: "applied", kind: "orthography", source },
        sessionId: "sess_abc12345", pluginVersion: "0.22.0",
      });
      expect(built).toEqual({ ok: false, reason: "payload.source" });
      expect(JSON.stringify(built)).not.toContain("PRIVATE_TEXT");
    },
  );

  it("не разрешает source у пропуска, confirm, choice и других событий", () => {
    for (const [event, payload] of [
      ["manual_fix_complete", { action: "skipped", kind: "orthography", source: "suggested" }],
      ["manual_fix_complete", { action: "applied", kind: "confirm", source: "custom" }],
      ["manual_fix_complete", { action: "skipped", kind: "confirm", source: "unknown" }],
      ["choice_resolved", { action: "confirmed", source: "suggested" }],
      ["choice_resolved", { action: "skipped", source: "suggested" }],
      ["spellcheck_requested", { source: "unknown" }],
      ["plugin_open", { has_text_layers: true, source: "suggested" }],
    ] as const) {
      const built = buildAnalyticsEnvelope({
        event, payload: payload as never,
        sessionId: "sess_abc12345", pluginVersion: "0.22.0",
      });
      expect(built).toEqual({ ok: false, reason: "payload.source" });
    }
  });

  it("сохраняет enum источника, отбрасывая слова и прочие приватные поля", () => {
    const built = buildAnalyticsEnvelope({
      event: "manual_fix_complete",
      payload: {
        action: "applied", kind: "orthography", source: "custom",
        // @ts-expect-error приватные поля должны быть отброшены
        before: "PRIVATE_TEXT", after: "PRIVATE_TEXT", sourceText: "PRIVATE_TEXT",
        candidate: "PRIVATE_TEXT", extra: { nodeId: "PRIVATE_TEXT" },
      },
      sessionId: "sess_abc12345", pluginVersion: "0.22.0",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const json = serializeAnalyticsEnvelope(built.envelope)!;
    expect(JSON.parse(json).payload).toEqual({ action: "applied", kind: "orthography", source: "custom" });
    expect(json).not.toContain("PRIVATE_TEXT");
  });

  it.each(["evt_" + "a".repeat(12), "evt_" + "Z_9-".repeat(15)])(
    "сохраняет одноразовый event_id допустимой длины", (event_id) => {
      const built = buildAnalyticsEnvelope({
        event: "manual_fix_complete",
        payload: { action: "applied", kind: "orthography", source: "suggested", event_id },
        sessionId: "sess_abc12345", pluginVersion: "0.22.0",
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(JSON.parse(serializeAnalyticsEnvelope(built.envelope)!).payload).toEqual({
        action: "applied", kind: "orthography", source: "suggested", event_id,
      });
    },
  );

  it.each(["", "evt_" + "a".repeat(11), "evt_" + "a".repeat(61), "sess_123456789012",
    "evt_PRIVATE TEXT", "evt_123456789012\n", "evt_123456789012\r", null, 42, {}, undefined])("отклоняет неверный event_id #%s", (event_id) => {
    const built = buildAnalyticsEnvelope({
      event: "manual_fix_complete",
      payload: { action: "applied", kind: "orthography", source: "custom", event_id } as never,
      sessionId: "sess_abc12345", pluginVersion: "0.22.0",
    });
    expect(built).toEqual({ ok: false, reason: "payload.event_id" });
  });

  it("не разрешает event_id вне состоявшейся орфографической замены", () => {
    for (const [event, payload] of [
      ["manual_fix_complete", { action: "skipped", kind: "orthography" }],
      ["manual_fix_complete", { action: "applied", kind: "confirm" }],
      ["choice_resolved", { action: "confirmed" }],
      ["plugin_open", { has_text_layers: true }],
    ] as const) {
      const built = buildAnalyticsEnvelope({
        event, payload: { ...payload, event_id: "evt_123456789012" } as never,
        sessionId: "sess_abc12345", pluginVersion: "0.22.0",
      });
      expect(built).toEqual({ ok: false, reason: "payload.event_id" });
    }
  });

  it("мапит неизвестную категорию в other", () => {
    expect(mapRuleCategoryToAnalytics("cian_editorial")).toBe("cian_editorial");
    expect(mapRuleCategoryToAnalytics("weird_new")).toBe("other");
    expect(aggregateAnalyticsCategories(["typography", "typography", "weird_new"])).toEqual({
      typography: 2,
      other: 1,
    });
  });

  it("сериализованный envelope укладывается в лимит Apps Script", () => {
    const built = buildAnalyticsEnvelope({
      event: "auto_fix_complete",
      payload: {
        found: 999,
        applied: 888,
        not_applied: 111,
        duration_ms: 12_345,
        categories: {
          typography: 100,
          cian_branding: 50,
          orthography: 25,
          other: 10,
        },
      },
      sessionId: "sess_abc12345678901234567890123456789012",
      pluginVersion: "0.18.0-test-build-tag",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const json = serializeAnalyticsEnvelope(built.envelope);
    expect(json).toBeTruthy();
    expect(json!.length).toBeLessThanOrEqual(4000);
  });

  it("список forbidden keys покрывает типовые утечки", () => {
    for (const key of [
      "before",
      "after",
      "sourceText",
      "nodeName",
      "nodeId",
      "email",
      "stack",
      "message",
    ]) {
      expect(ANALYTICS_FORBIDDEN_KEYS).toContain(key);
    }
  });
});
