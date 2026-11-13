import { describe, expect, it } from "vitest";
import { AnalyticsFailure, annotateFailure } from "./failure";

describe("AnalyticsFailure / annotateFailure", () => {
  it("берёт message из Error и сохраняет stage/code/original", () => {
    const original = new Error("font missing");
    const failure = new AnalyticsFailure("auto_apply", "font_load_failed", original);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe("font missing");
    expect(failure.stage).toBe("auto_apply");
    expect(failure.code).toBe("font_load_failed");
    expect(failure.original).toBe(original);
  });

  it("для не-Error показывает строковое значение", () => {
    const failure = new AnalyticsFailure("scan", "scan_failed", "boom");
    expect(failure.message).toBe("boom");
    expect(failure.original).toBe("boom");
  });

  it("annotateFailure не заворачивает уже помеченную ошибку повторно", () => {
    const first = annotateFailure(new Error("PRIVATE"), "scan", "scan_failed");
    const second = annotateFailure(first, "ui", "unknown");
    expect(second).toBe(first);
    expect(second.stage).toBe("scan");
    expect(second.code).toBe("scan_failed");
  });

  it("annotateFailure оборачивает сырой throw", () => {
    const annotated = annotateFailure(new Error("node gone"), "manual_apply", "node_missing");
    expect(annotated).toBeInstanceOf(AnalyticsFailure);
    expect(annotated.stage).toBe("manual_apply");
    expect(annotated.code).toBe("node_missing");
    expect(annotated.message).toBe("node gone");
  });
});
