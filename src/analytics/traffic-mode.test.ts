import { describe, it, expect } from "vitest";
import { buildAnalyticsEnvelope, serializeAnalyticsEnvelope } from "./schema";
import { resolveAnalyticsBuild } from "../../scripts/analytics-build-config.mjs";

describe("T-151 configuration and serialization", () => {
  it("preserves explicit modes across serialization; absence stays absent", () => {
    for (const trafficMode of ["test", "production", undefined] as const) {
      const b = buildAnalyticsEnvelope({ event: "plugin_open", payload: { has_text_layers: false }, sessionId: "sess_fixture01", pluginVersion: "0.23.0", ...(trafficMode ? { trafficMode } : {}) });
      expect(b.ok).toBe(true);
      if (b.ok) expect(JSON.parse(serializeAnalyticsEnvelope(b.envelope)!)).toEqual(b.envelope);
    }
  });
  it("rejects malformed explicit modes on reserialization too", () => {
    const b = buildAnalyticsEnvelope({ event: "plugin_open", payload: { has_text_layers: false }, sessionId: "sess_fixture01", pluginVersion: "0.23.0" });
    if (!b.ok) throw new Error("fixture failed");
    for (const traffic_mode of [null, undefined, "", "unknown", "production "]) {
      expect(serializeAnalyticsEnvelope({ ...b.envelope, traffic_mode } as any)).toBeNull();
    }
  });
  it("defaults to no analytics and requires complete opt-in", () => {
    expect(resolveAnalyticsBuild({}).enabled).toBe(false);
    for (const env of [{ ANALYTICS: "1" }, { ANALYTICS: "1", ANALYTICS_TRAFFIC_MODE: "test" },
      { ANALYTICS: "1", ANALYTICS_TRAFFIC_MODE: "production", PLUGIN_VERSION: "smoke" }, { ANALYTICS: "yes" }]) {
      expect(() => resolveAnalyticsBuild(env)).toThrow();
    }
    for (const mode of ["test", "production"]) expect(resolveAnalyticsBuild({ ANALYTICS: "1", ANALYTICS_TRAFFIC_MODE: mode, PLUGIN_VERSION: "0.23.0" })).toMatchObject({ enabled: true, trafficMode: mode, pluginVersion: "0.23.0" });
  });
});
