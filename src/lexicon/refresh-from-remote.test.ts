import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetBoundaryExceptionsToBundled } from "./boundary-exceptions-store";
import { resetSheetRulesToBundled } from "./replacement-rules-store";
import {
  refreshBoundaryExceptionsFromRemote,
  refreshTextReplacementsFromRemote,
} from "./refresh-from-remote";

describe("refresh-from-remote", () => {
  beforeEach(() => {
    resetSheetRulesToBundled();
    resetBoundaryExceptionsToBundled();
  });

  it("возвращает bundled при пустом URL", async () => {
    const result = await refreshTextReplacementsFromRemote("", async () => "");
    expect(result.ok).toBe(true);
    expect(result.fromRemote).toBe(false);
    expect(result.ruleCount).toBeGreaterThan(0);
  });

  it("подставляет remote CSV", async () => {
    const csv = `исходные варианты,верный текст
тестовое,замена`;
    const result = await refreshTextReplacementsFromRemote("https://example.com/x.csv", async () => csv);
    expect(result).toMatchObject({ ok: true, fromRemote: true, ruleCount: 1 });
  });

  it("сбрасывает CSV на bundled при HTML-ответе", async () => {
    const bundledCount = (await refreshTextReplacementsFromRemote("", async () => "")).ruleCount;
    const result = await refreshTextReplacementsFromRemote(
      "https://example.com/x.csv",
      async () => "<!DOCTYPE html><html>",
    );
    expect(result.ok).toBe(false);
    expect(result.ruleCount).toBe(bundledCount);
  });

  it("подставляет remote boundary exceptions", async () => {
    const result = await refreshBoundaryExceptionsFromRemote(
      "https://example.com/x.txt",
      async () => "Knight Frank\nИИ\n",
    );
    expect(result).toMatchObject({ ok: true, fromRemote: true, phraseCount: 2 });
  });

  it("сбрасывает boundary exceptions на bundled при сетевой ошибке", async () => {
    const bundledCount = (
      await refreshBoundaryExceptionsFromRemote("", async () => "")
    ).phraseCount;
    const fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await refreshBoundaryExceptionsFromRemote(
      "https://example.com/x.txt",
      fetch,
    );
    expect(result.ok).toBe(false);
    expect(result.phraseCount).toBe(bundledCount);
  });
});
