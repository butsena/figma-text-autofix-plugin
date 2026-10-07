import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginAnalyticsSession,
  getAnalyticsSessionId,
  resetAnalyticsSessionForTests,
  trackAnalytics,
} from "./track";

vi.mock("../config/analytics-config", () => ({
  ANALYTICS_CONFIG: {
    pluginVersion: "0.18.0-test",
    endpointUrl: "https://script.google.com/macros/s/fake/exec",
    enabled: true,
    timeoutMs: 50,
  },
  isAnalyticsConfigured: () => true,
}));

describe("trackAnalytics", () => {
  beforeEach(() => {
    resetAnalyticsSessionForTests();
  });

  afterEach(() => {
    resetAnalyticsSessionForTests();
  });

  it("каждый beginAnalyticsSession даёт новый session_id", () => {
    const a = beginAnalyticsSession();
    const b = beginAnalyticsSession();
    expect(a).not.toBe(b);
    expect(a.startsWith("sess_")).toBe(true);
    expect(getAnalyticsSessionId()).toBe(b);
  });

  it("шлёт POST и не пробрасывает ошибку fetch", async () => {
    const calls: unknown[] = [];
    const fetchImpl = vi.fn(async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      throw new Error("network down");
    });

    beginAnalyticsSession();
    expect(() =>
      trackAnalytics("plugin_open", { has_text_layers: false }, { fetchImpl }),
    ).not.toThrow();

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      url: "https://script.google.com/macros/s/fake/exec",
      body: {
        schema_version: 1,
        event: "plugin_open",
        payload: { has_text_layers: false },
      },
    });
    const body = (calls[0] as { body: Record<string, unknown> }).body;
    expect(JSON.stringify(body)).not.toMatch(/network down|stack|nodeName/);
  });

  it("таймаут не отклоняет вызывающий код", async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<{ ok: boolean; status: number }>((resolve) => {
          setTimeout(() => resolve({ ok: true, status: 200 }), 200);
        }),
    );
    beginAnalyticsSession();
    trackAnalytics("scan_complete", {
      checked_layers: 1,
      found_fixes: 0,
      confirm_fixes: 0,
      choice_fixes: 0,
      duration_ms: 10,
    }, { fetchImpl });
    await new Promise((r) => setTimeout(r, 80));
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe("trackAnalytics disabled", () => {
  it("не ходит в сеть без endpoint", async () => {
    vi.resetModules();
    vi.doMock("../config/analytics-config", () => ({
      ANALYTICS_CONFIG: {
        pluginVersion: "0.18.0-test",
        endpointUrl: "",
        enabled: true,
        timeoutMs: 50,
      },
      isAnalyticsConfigured: () => false,
    }));
    const mod = await import("./track");
    mod.resetAnalyticsSessionForTests();
    const fetchImpl = vi.fn();
    mod.beginAnalyticsSession();
    mod.trackAnalytics("plugin_open", { has_text_layers: true }, { fetchImpl });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
