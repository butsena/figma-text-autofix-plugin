import { describe, expect, it, vi } from "vitest";
import { applyDownloadedResource, runRemoteRefresh } from "./remote-refresh-runner";

describe("applyDownloadedResource", () => {
  it("отклоняет HTML-ответ", () => {
    const result = applyDownloadedResource(
      "<!DOCTYPE html>",
      "https://example.com/x.txt",
      {
        invalidFormatMessage: "не тот формат",
        unrecognizedMessage: "не распознано",
        getCounts: () => ({ count: 3 }),
        apply: () => true,
      },
      (counts, errorMessage, fetchUrl) => ({
        ok: false as const,
        fromRemote: false,
        ...counts,
        errorMessage,
        fetchUrl,
      }),
      (counts, fetchUrl) => ({ ok: true as const, fromRemote: true, ...counts, fetchUrl }),
    );
    expect(result).toMatchObject({
      ok: false,
      count: 3,
      errorMessage: "не тот формат",
      fetchUrl: "https://example.com/x.txt",
    });
  });

  it("отклоняет, если apply вернул false", () => {
    const result = applyDownloadedResource(
      "мусор",
      "https://example.com/x.txt",
      {
        invalidFormatMessage: "html",
        unrecognizedMessage: "не распознано. Начало",
        getCounts: () => ({ count: 1 }),
        apply: () => false,
      },
      (counts, errorMessage, fetchUrl) => ({
        ok: false as const,
        fromRemote: false,
        ...counts,
        errorMessage,
        fetchUrl,
      }),
      (counts, fetchUrl) => ({ ok: true as const, fromRemote: true, ...counts, fetchUrl }),
    );
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("не распознано. Начало");
  });

  it("возвращает success при удачном apply", () => {
    const apply = vi.fn().mockReturnValue(true);
    const result = applyDownloadedResource(
      "ok",
      "https://example.com/x.txt",
      {
        invalidFormatMessage: "html",
        unrecognizedMessage: "nope",
        getCounts: () => ({ count: 7 }),
        apply,
      },
      (counts, errorMessage, fetchUrl) => ({
        ok: false as const,
        fromRemote: false,
        ...counts,
        errorMessage,
        fetchUrl,
      }),
      (counts, fetchUrl) => ({ ok: true as const, fromRemote: true, ...counts, fetchUrl }),
    );
    expect(apply).toHaveBeenCalledWith("ok");
    expect(result).toEqual({
      ok: true,
      fromRemote: true,
      count: 7,
      fetchUrl: "https://example.com/x.txt",
    });
  });
});

describe("runRemoteRefresh", () => {
  it("на пустом URL сбрасывает bundled и не ходит в сеть", async () => {
    const resetBundled = vi.fn();
    const fetchText = vi.fn();
    const result = await runRemoteRefresh("", "label", fetchText, {
      resetBundled,
      buildEmptyUrlResult: () => ({ ok: true, fromRemote: false, n: 1 }),
      processDownload: () => ({ ok: true, fromRemote: true, n: 2 }),
      buildNetworkErrorResult: () => ({ ok: false, fromRemote: false, n: 0 }),
    });
    expect(resetBundled).toHaveBeenCalled();
    expect(fetchText).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, fromRemote: false, n: 1 });
  });

  it("при ошибке fetch сбрасывает bundled", async () => {
    const resetBundled = vi.fn();
    const result = await runRemoteRefresh(
      "https://example.com/x.txt",
      "label",
      async () => {
        throw new Error("down");
      },
      {
        resetBundled,
        buildEmptyUrlResult: () => ({ ok: true, fromRemote: false }),
        processDownload: () => ({ ok: true, fromRemote: true }),
        buildNetworkErrorResult: (fetchUrl, error) => ({
          ok: false,
          fromRemote: false,
          fetchUrl,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      },
    );
    expect(resetBundled).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      fetchUrl: "https://example.com/x.txt",
      errorMessage: "down",
    });
  });

  it("при ok:false от processDownload сбрасывает bundled", async () => {
    const resetBundled = vi.fn();
    const result = await runRemoteRefresh(
      "https://example.com/x.txt",
      "label",
      async () => "bad",
      {
        resetBundled,
        buildEmptyUrlResult: () => ({ ok: true, fromRemote: false }),
        processDownload: () => ({ ok: false, fromRemote: false }),
        buildNetworkErrorResult: () => ({ ok: false, fromRemote: false }),
      },
    );
    expect(resetBundled).toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("возвращает remote-результат при успехе", async () => {
    const resetBundled = vi.fn();
    const result = await runRemoteRefresh(
      "https://example.com/x.txt",
      "label",
      async () => "good",
      {
        resetBundled,
        buildEmptyUrlResult: () => ({ ok: true, fromRemote: false }),
        processDownload: (text, fetchUrl) => ({
          ok: true,
          fromRemote: true,
          text,
          fetchUrl,
        }),
        buildNetworkErrorResult: () => ({ ok: false, fromRemote: false }),
      },
    );
    expect(resetBundled).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      fromRemote: true,
      text: "good",
      fetchUrl: "https://example.com/x.txt",
    });
  });
});
