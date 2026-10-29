import { describe, expect, it } from "vitest";
import { buildAnalyticsEnvelope, type PluginErrorPayload } from "./schema";

const build = (payload: unknown) => buildAnalyticsEnvelope({
  event: "plugin_error", payload: payload as PluginErrorPayload,
  sessionId: "sess_local12345678", pluginVersion: "smoke",
});

describe("T-144: error contract", () => {
  it("preserves unclassified legacy history", () => {
    const result = build({ stage: "ui", code: "unknown" });
    expect(result.ok && result.envelope.payload).toEqual({ stage: "ui", code: "unknown" });
  });
  it.each(["bundled", "cache"])("keeps confirmed recovery via %s without private context", (recovery) => {
    const result = build({
      stage: "spell", code: "spell_load_failed", outcome: "recovered",
      resource: recovery === "cache" ? "spell_dictionary" : "spell_whitelist",
      recovery, message: "PRIVATE", stack: "PRIVATE",
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it.each([
    { outcome: "PRIVATE" }, { outcome: null }, { resource: "PRIVATE", outcome: "failed" },
    { outcome: "recovered" }, { recovery: "cache" },
    { outcome: "failed", recovery: "cache" },
    { stage: "manual_apply", outcome: "recovered", recovery: "cache", resource: "spell_dictionary" },
  ])("rejects inconsistent or open text metadata %j", (extra) => {
    expect(build({ stage: "spell", code: "spell_load_failed", ...extra }).ok).toBe(false);
  });
});
