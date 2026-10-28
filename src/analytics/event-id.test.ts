import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnalyticsEventId } from "./event-id";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("одноразовый analytics event id", () => {
  it("использует новый случайный набор байтов для каждого события", () => {
    let sequence = 0;
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(++sequence);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    const first = createAnalyticsEventId();
    const second = createAnalyticsEventId();
    expect(first).toMatch(/^evt_[A-Za-z0-9_-]{16,64}$/);
    expect(second).toMatch(/^evt_[A-Za-z0-9_-]{16,64}$/);
    expect(first).not.toBe(second);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("работает без Web Crypto в sandbox", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValue(0.2);
    const first = createAnalyticsEventId();
    const second = createAnalyticsEventId();
    expect(first).toMatch(/^evt_[A-Za-z0-9_-]{16,64}$/);
    expect(second).toMatch(/^evt_[A-Za-z0-9_-]{16,64}$/);
    expect(first).not.toBe(second);
  });
});
