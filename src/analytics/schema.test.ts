import { describe, expect, it } from "vitest";
import {
  ANALYTICS_FORBIDDEN_KEYS,
  ANALYTICS_SCHEMA_VERSION,
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
