import { describe, expect, it } from "vitest";
import type { AutoApplyReportDto } from "../shared/messages";
import { buildAnalyticsEnvelope } from "./schema";
import { followUpAutoFixPayload } from "./follow-up-auto";

function report(fixes: ReadonlyArray<{ fixId: string; category: string }>): AutoApplyReportDto {
  return {
    summary: {
      checkedLayers: 1,
      appliedFixCount: fixes.length,
      changedLayerCount: 1,
    },
    layers: [
      {
        nodeId: "9:9",
        nodeName: "Макет",
        characterCount: 4,
        fixes: fixes.map((fix) => ({
          fixId: fix.fixId,
          ruleId: "auto-rule",
          category: fix.category,
          message: "m",
          before: "было",
          after: "стало",
          from: 0,
          to: 4,
          sourceText: "было",
        })),
      },
    ],
  };
}

describe("followUpAutoFixPayload", () => {
  it("складывает несколько новых проходов и не повторяет уже учтённое", () => {
    const before = report([{ fixId: "old", category: "cian_branding" }]);
    const after = report([
      { fixId: "old", category: "cian_branding" },
      { fixId: "nbsp", category: "typography" },
      { fixId: "group", category: "numeric_formatting" },
    ]);

    const payload = followUpAutoFixPayload(before, after, 0, 12);

    expect(payload).toEqual({
      found: 2,
      applied: 2,
      not_applied: 0,
      duration_ms: 12,
      categories: { typography: 1, numeric_formatting: 1 },
    });
  });

  it("нулевая дельта не создаёт событие", () => {
    const same = report([{ fixId: "old", category: "typography" }]);
    expect(followUpAutoFixPayload(same, same, 4, 10)).toBeNull();
    expect(followUpAutoFixPayload(null, report([]), 0, 0)).toBeNull();
  });

  it("частичный успех соблюдает контракт found и категорий", () => {
    const payload = followUpAutoFixPayload(
      null,
      report([
        { fixId: "a", category: "typography" },
        { fixId: "b", category: "typography" },
      ]),
      1,
      7.9,
    );

    expect(payload).toEqual({
      found: 3,
      applied: 2,
      not_applied: 1,
      duration_ms: 7,
      categories: { typography: 2 },
    });
    const categorySum = Object.values(payload?.categories ?? {}).reduce((sum, n) => sum + n, 0);
    expect(categorySum).toBe(payload?.applied);
    expect(payload && payload.found).toBe((payload?.applied ?? 0) + (payload?.not_applied ?? 0));
  });

  it("не кладёт текст и идентификаторы в событие, которое примет приёмник", () => {
    const payload = followUpAutoFixPayload(null, report([{ fixId: "a", category: "other" }]), 0, -5);
    expect(payload?.duration_ms).toBe(0);
    const built = buildAnalyticsEnvelope({
      event: "auto_fix_complete",
      payload: payload!,
      sessionId: "sess_fixture01",
      pluginVersion: "0.22.0", trafficMode: "test",
      clientTime: "2026-10-27T12:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const serialized = JSON.stringify(built.envelope);
    expect(serialized).not.toMatch(/было|стало|9:9|Макет/);
    expect(built.envelope.payload).toEqual({
      found: 1,
      applied: 1,
      not_applied: 0,
      duration_ms: 0,
      categories: { other: 1 },
    });
  });
});
