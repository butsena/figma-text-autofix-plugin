import { describe, expect, it, beforeEach } from "vitest";
import {
  applyBoundaryExceptionsFromRaw,
  getBoundaryExceptions,
  getBoundaryExceptionsLoadStats,
  resetBoundaryExceptionsToBundled,
} from "./boundary-exceptions-store";

describe("boundary-exceptions-store", () => {
  beforeEach(() => {
    resetBoundaryExceptionsToBundled();
  });

  it("подставляет remote-список целиком без merge с bundled", () => {
    const ok = applyBoundaryExceptionsFromRaw("Knight Frank\nИИ\n");
    expect(ok).toBe(true);
    expect(getBoundaryExceptions()).toEqual(["Knight Frank", "ИИ"]);
    expect(getBoundaryExceptionsLoadStats()).toMatchObject({
      fromRemote: true,
      count: 2,
    });
  });

  it("при сбросе возвращает bundled", () => {
    applyBoundaryExceptionsFromRaw("Только одно\n");
    resetBoundaryExceptionsToBundled();

    const stats = getBoundaryExceptionsLoadStats();
    expect(stats.fromRemote).toBe(false);
    expect(stats.count).toBeGreaterThan(1);
  });
});
