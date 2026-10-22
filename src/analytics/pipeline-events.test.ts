import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAnalyticsSessionForTests } from "./track";

const trackAnalytics = vi.fn();

vi.mock("./track", () => ({
  beginAnalyticsSession: vi.fn(() => "sess_test12345678"),
  resetAnalyticsSessionForTests: vi.fn(),
  trackAnalytics: (...args: unknown[]) => trackAnalytics(...args),
}));

vi.mock("../config/analytics-config", () => ({
  isAnalyticsConfigured: () => true,
}));

import {
  mapErrorToAnalyticsCode,
  trackAutoFixComplete,
  trackManualFixFromDto,
  trackPluginError,
  trackSpellcheckRequested,
} from "./pipeline-events";

describe("pipeline-events", () => {
  beforeEach(() => {
    trackAnalytics.mockClear();
    resetAnalyticsSessionForTests();
  });

  it("choice apply → choice_resolved confirmed", () => {
    trackManualFixFromDto(
      {
        fixId: "f1",
        from: 0,
        to: 7,
        before: "напишите",
        after: "напишете",
        rule: {
          id: "cian-choice-napishite",
          category: "form_choice",
          message: "Выберите форму",
          applyPolicy: "choice",
          choiceOptions: ["напишите", "напишете"],
        },
      },
      "applied",
    );
    expect(trackAnalytics).toHaveBeenCalledWith("choice_resolved", { action: "confirmed" });
  });

  it("orthography skip → manual_fix_complete skipped orthography", () => {
    trackManualFixFromDto(
      {
        fixId: "f2",
        from: 0,
        to: 7,
        before: "Кватира",
        after: "Квартира",
        rule: {
          id: "orthography-spellcheck",
          category: "orthography",
          message: "Опечатка",
          applyPolicy: "confirm",
        },
      },
      "skipped",
    );
    expect(trackAnalytics).toHaveBeenCalledWith("manual_fix_complete", {
      action: "skipped",
      kind: "orthography",
    });
  });

  it("auto_fix_complete агрегирует категории без текста", () => {
    trackAutoFixComplete(
      {
        summary: { checkedLayers: 1, appliedFixCount: 2, changedLayerCount: 1 },
        layers: [
          {
            nodeId: "n1",
            nodeName: "Layer",
            characterCount: 10,
            fixes: [
              {
                fixId: "a",
                ruleId: "cian-001",
                category: "cian_branding",
                message: "m",
                before: "X",
                after: "Y",
                from: 0,
                to: 1,
                sourceText: "X",
              },
              {
                fixId: "b",
                ruleId: "cian-095",
                category: "typography",
                message: "m",
                before: " ",
                after: "\u00a0",
                from: 1,
                to: 2,
                sourceText: "X Y",
              },
            ],
          },
        ],
      },
      1,
      50,
    );
    expect(trackAnalytics).toHaveBeenCalledWith("auto_fix_complete", {
      found: 3,
      applied: 2,
      not_applied: 1,
      duration_ms: 50,
      categories: { cian_branding: 1, typography: 1 },
    });
    expect(JSON.stringify(trackAnalytics.mock.calls[0])).not.toMatch(/nodeName|sourceText|before/);
  });

  it("spellcheck_requested — пустой payload", () => {
    trackSpellcheckRequested();
    expect(trackAnalytics).toHaveBeenCalledWith("spellcheck_requested", {});
  });

  it("plugin_error не шлёт message/stack", () => {
    trackPluginError("scan", new Error("font load failed for Inter"));
    expect(trackAnalytics).toHaveBeenCalledWith("plugin_error", {
      stage: "scan",
      code: "font_load_failed",
    });
    expect(JSON.stringify(trackAnalytics.mock.calls[0])).not.toMatch(/font load failed|stack/);
  });

  it("mapErrorToAnalyticsCode для неизвестной ошибки", () => {
    expect(mapErrorToAnalyticsCode("boom")).toBe("unknown");
  });
});
