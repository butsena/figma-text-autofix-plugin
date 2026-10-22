import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONFIG,
  isAnalyticsConfigured,
  isAnalyticsEndpointReady,
} from "./analytics-config";

describe("analytics config", () => {
  it("в тестовой сборке аналитика выключена, endpoint при этом валидный", () => {
    expect(ANALYTICS_CONFIG.enabled).toBe(false);
    expect(ANALYTICS_CONFIG.endpointUrl.startsWith("https://")).toBe(true);
    expect(ANALYTICS_CONFIG.endpointUrl.endsWith("/exec")).toBe(true);
    expect(ANALYTICS_CONFIG.timeoutMs).toBe(2500);
    expect(isAnalyticsConfigured()).toBe(false);
  });

  it("принимает только включённый https-endpoint с /exec", () => {
    const url = "https://script.google.com/macros/s/abc/exec";
    expect(isAnalyticsEndpointReady(true, url)).toBe(true);
    expect(isAnalyticsEndpointReady(false, url)).toBe(false);
    expect(isAnalyticsEndpointReady(true, "http://script.google.com/macros/s/abc/exec")).toBe(
      false,
    );
    expect(isAnalyticsEndpointReady(true, "https://example.com/callback")).toBe(false);
  });
});
