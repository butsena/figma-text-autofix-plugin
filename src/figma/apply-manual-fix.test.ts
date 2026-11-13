import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextFixDto } from "../shared/messages";
import type { AnalyticsSpellingSource } from "../analytics/schema";

const trackAnalytics = vi.fn();

vi.mock("../analytics/track", () => ({
  beginAnalyticsSession: vi.fn(() => "sess_test12345678"),
  resetAnalyticsSessionForTests: vi.fn(),
  trackAnalytics: (...args: unknown[]) => trackAnalytics(...args),
}));

vi.mock("./autofix-pipeline", () => ({
  runAutofixAutoPasses: vi.fn(async (_selection: unknown, existing: unknown) => ({
    report: existing ?? {
      summary: { checkedLayers: 0, appliedFixCount: 0, changedLayerCount: 0 },
      layers: [],
    },
    finalScan: { summary: { foundFixes: 0 } },
  })),
}));

vi.mock("./check-result-session", async () => {
  const actual = await vi.importActual<typeof import("./check-result-session")>("./check-result-session");
  return {
    ...actual,
    postCheckResultToUi: vi.fn(),
  };
});

import type { AutoApplyReportDto } from "../shared/messages";
import { applyTextFixesToTextNode } from "./apply-fixes";
import { runAutofixAutoPasses } from "./autofix-pipeline";
import { applyManualFixAndRefresh, applyManualFixBatchAndRefresh, resetManualApplyInFlightForTests, skipManualFixAndRefresh } from "./apply-manual-fix";
import { postCheckResultToUi, setLastAutoApplyReport, setLastManualApplyReport } from "./check-result-session";

vi.mock("./apply-fixes", () => ({
  applyTextFixesToTextNode: vi.fn(),
}));

type FakeTextNode = {
  id: string;
  name: string;
  type: "TEXT";
  characters: string;
  parent: null;
  getPluginData: (key: string) => string;
  setPluginData: (key: string, value: string) => void;
};

function fakeTextNode(characters: string): FakeTextNode {
  const data = new Map<string, string>();
  return {
    id: "1:2",
    name: "Слой",
    type: "TEXT",
    characters,
    parent: null,
    getPluginData: (key) => data.get(key) ?? "",
    setPluginData: (key, value) => {
      data.set(key, value);
    },
  };
}

function confirmFix(overrides: Partial<TextFixDto> = {}): TextFixDto {
  return {
    fixId: "f1",
    from: 0,
    to: 7,
    before: "Кватира",
    after: "Квартира",
    rule: {
      id: "cian-confirm",
      category: "typography",
      message: "m",
      applyPolicy: "confirm",
      priority: 1,
    },
    ...overrides,
  };
}

function spellFix(): TextFixDto {
  return confirmFix({
    rule: {
      id: "orthography-spellcheck",
      category: "orthography",
      message: "Опечатка",
      applyPolicy: "confirm",
      priority: 1,
    },
  });
}

function choiceFix(after: string): TextFixDto {
  return {
    fixId: "c1",
    from: 0,
    to: 8,
    before: "напишите",
    after,
    rule: {
      id: "cian-choice-napishite",
      category: "form_choice",
      message: "Выберите форму",
      applyPolicy: "choice",
      priority: 1,
      choiceOptions: ["напишите", "напишете"],
    },
  };
}

function emptyAutoReport(): AutoApplyReportDto {
  return {
    summary: { checkedLayers: 0, appliedFixCount: 0, changedLayerCount: 0 },
    layers: [],
  };
}

function autoReport(fixes: ReadonlyArray<{ fixId: string; category: string }>): AutoApplyReportDto {
  return {
    summary: {
      checkedLayers: 1,
      appliedFixCount: fixes.length,
      changedLayerCount: fixes.length > 0 ? 1 : 0,
    },
    layers: [
      {
        nodeId: "1:2",
        nodeName: "Слой",
        characterCount: 8,
        fixes: fixes.map((fix) => ({
          fixId: fix.fixId,
          ruleId: "auto-rule",
          category: fix.category,
          message: "m",
          before: "секретный текст",
          after: "ещё секрет",
          from: 0,
          to: 1,
          sourceText: "секретный текст",
        })),
      },
    ],
  };
}

function installNode(node: FakeTextNode | null): void {
  vi.stubGlobal("figma", {
    getNodeByIdAsync: vi.fn(async () => node),
    currentPage: { selection: node ? [node] : [] },
  });
}

describe("applyManualFixAndRefresh", () => {
  beforeEach(() => {
    trackAnalytics.mockClear();
    resetManualApplyInFlightForTests();
    setLastAutoApplyReport(null);
    setLastManualApplyReport(null);
    vi.mocked(applyTextFixesToTextNode).mockReset();
    vi.mocked(runAutofixAutoPasses).mockReset();
    vi.mocked(runAutofixAutoPasses).mockImplementation(async (_selection: unknown, existing: unknown) => ({
      report: (existing ?? emptyAutoReport()) as AutoApplyReportDto,
      finalScan: { summary: { foundFixes: 0 } },
    }) as Awaited<ReturnType<typeof runAutofixAutoPasses>>);
  });

  it("обычная замена без изменения текста не считается успехом", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    const unchanged = { ...spellFix(), after: "Кватира" };

    await applyManualFixAndRefresh(node.id, unchanged, "suggested");

    expect(applyTextFixesToTextNode).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it("T-130 F01: пустой результат не увеличивает успешные изменения", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockResolvedValue([]);

    await applyManualFixAndRefresh(node.id, spellFix(), "custom");

    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(runAutofixAutoPasses).toHaveBeenCalled();
  });

  it("успех confirm и орфографии отправляется после применения и один раз", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    const order: string[] = [];
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      order.push("apply");
      node.characters = "Квартира";
      return [{} as never];
    });
    trackAnalytics.mockImplementation(() => {
      order.push("track");
    });

    await applyManualFixAndRefresh(node.id, spellFix());

    expect(order).toEqual(["apply", "track"]);
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("manual_fix_complete", {
      action: "applied",
      kind: "orthography",
      source: "unknown",
      event_id: expect.stringMatching(/^evt_[A-Za-z0-9_-]{16,64}$/),
    });
    expect(JSON.stringify(trackAnalytics.mock.calls)).not.toMatch(/Кватира|Квартира/);
  });

  it.each(["suggested", "custom", "unknown"] as const)("source %s начисляется в том же единственном успешном событии", async (source) => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      node.characters = "Квартира";
      return [{} as never];
    });

    await applyManualFixAndRefresh(node.id, spellFix(), source);

    expect(trackAnalytics).toHaveBeenCalledExactlyOnceWith("manual_fix_complete", {
      action: "applied", kind: "orthography", source,
      event_id: expect.stringMatching(/^evt_[A-Za-z0-9_-]{16,64}$/),
    });
  });

  it("невалидные метаданные не попадают в аналитику", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      node.characters = "Квартира";
      return [{} as never];
    });
    await applyManualFixAndRefresh(node.id, spellFix(), "текст пользователя" as AnalyticsSpellingSource);
    expect(trackAnalytics).toHaveBeenCalledExactlyOnceWith("manual_fix_complete", {
      action: "applied", kind: "orthography", source: "unknown",
      event_id: expect.stringMatching(/^evt_[A-Za-z0-9_-]{16,64}$/),
    });
  });

  it("нет слоя, устаревший фрагмент и исключение не пишут успех", async () => {
    installNode(null);
    await applyManualFixAndRefresh("missing", spellFix(), "suggested");
    expect(trackAnalytics).toHaveBeenCalledExactlyOnceWith("plugin_error", {
      stage: "manual_apply", code: "node_missing", outcome: "failed",
    });
    trackAnalytics.mockClear();

    const stale = fakeTextNode("уже другое");
    installNode(stale);
    vi.mocked(applyTextFixesToTextNode).mockResolvedValue([]);
    await applyManualFixAndRefresh(stale.id, spellFix(), "custom");
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(runAutofixAutoPasses).toHaveBeenCalled();

    trackAnalytics.mockClear();
    vi.mocked(runAutofixAutoPasses).mockClear();
    const node = fakeTextNode("Кватира");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockRejectedValue(new Error("apply failed"));
    await expect(applyManualFixAndRefresh(node.id, spellFix(), "suggested")).rejects.toThrow("apply failed");
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(runAutofixAutoPasses).not.toHaveBeenCalled();
  });

  it("choice исходной формы — confirmed без изменения текста; повтор молчит", async () => {
    const node = fakeTextNode("напишите мне");
    installNode(node);

    await applyManualFixAndRefresh(node.id, choiceFix("напишите"));
    await applyManualFixAndRefresh(node.id, choiceFix("напишите"));

    expect(applyTextFixesToTextNode).not.toHaveBeenCalled();
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("choice_resolved", { action: "confirmed" });
    expect(JSON.stringify(trackAnalytics.mock.calls)).not.toMatch(/напишите/);
  });

  it("choice с заменой текста не дублируется как manual_fix_complete", async () => {
    const node = fakeTextNode("напишите мне");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      node.characters = "напишете мне";
      return [{} as never];
    });

    await applyManualFixAndRefresh(node.id, choiceFix("напишете"), "custom");

    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("choice_resolved", { action: "confirmed" });
  });

  it("пропуск не считается исправлением", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);

    await skipManualFixAndRefresh(node.id, spellFix());

    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("manual_fix_complete", {
      action: "skipped",
      kind: "orthography",
    });
  });

  it("после ручной правки считает только новые auto за несколько проходов", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    const before = autoReport([{ fixId: "old", category: "cian_branding" }]);
    setLastAutoApplyReport(before);
    const afterFirstPass = autoReport([
      { fixId: "old", category: "cian_branding" },
      { fixId: "nbsp", category: "typography" },
    ]);
    const afterSecondPass = autoReport([
      { fixId: "old", category: "cian_branding" },
      { fixId: "nbsp", category: "typography" },
      { fixId: "group", category: "numeric_formatting" },
    ]);
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      node.characters = "Квартира";
      return [{} as never];
    });
    vi.mocked(runAutofixAutoPasses)
      .mockResolvedValueOnce({
        report: afterFirstPass,
        finalScan: { summary: { foundFixes: 1 } },
      } as Awaited<ReturnType<typeof runAutofixAutoPasses>>)
      .mockResolvedValueOnce({
        report: afterSecondPass,
        finalScan: { summary: { foundFixes: 2 } },
      } as Awaited<ReturnType<typeof runAutofixAutoPasses>>);

    await applyManualFixAndRefresh(node.id, spellFix());

    const autoCall = trackAnalytics.mock.calls.find((call) => call[0] === "auto_fix_complete");
    expect(autoCall?.[1]).toMatchObject({
      found: 4,
      applied: 2,
      not_applied: 2,
      categories: { typography: 1, numeric_formatting: 1 },
    });
    expect(autoCall?.[1].duration_ms).toEqual(expect.any(Number));
    expect(autoCall?.[1].duration_ms).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(autoCall)).not.toMatch(/секретный текст|Кватира|1:2/);
    expect(trackAnalytics).toHaveBeenCalledWith("manual_fix_complete", {
      action: "applied",
      kind: "orthography",
      source: "unknown",
      event_id: expect.stringMatching(/^evt_[A-Za-z0-9_-]{16,64}$/),
    });
    expect(trackAnalytics.mock.calls.filter((call) => call[0] === "auto_fix_complete")).toHaveLength(1);
  });

  it("нулевая дельта и повторный клик не отправляют накопленный отчёт", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    const accumulated = autoReport([{ fixId: "old", category: "typography" }]);
    setLastAutoApplyReport(accumulated);
    vi.mocked(applyTextFixesToTextNode)
      .mockImplementationOnce(async () => {
        node.characters = "Квартира";
        return [{} as never];
      })
      .mockResolvedValueOnce([]);

    await applyManualFixAndRefresh(node.id, spellFix());
    await applyManualFixAndRefresh(node.id, spellFix());

    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("manual_fix_complete", {
      action: "applied",
      kind: "orthography",
      source: "unknown",
      event_id: expect.stringMatching(/^evt_[A-Za-z0-9_-]{16,64}$/),
    });
    expect(trackAnalytics.mock.calls.some((call) => call[0] === "auto_fix_complete")).toBe(false);
  });

  it("ошибка второго прохода сохраняет уже выполненную дельту и не повторяет старый отчёт", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    setLastAutoApplyReport(autoReport([{ fixId: "old", category: "cian_branding" }]));
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      node.characters = "Квартира";
      return [{} as never];
    });
    vi.mocked(runAutofixAutoPasses)
      .mockResolvedValueOnce({
        report: autoReport([
          { fixId: "old", category: "cian_branding" },
          { fixId: "nbsp", category: "typography" },
        ]),
        finalScan: { summary: { foundFixes: 1 } },
      } as Awaited<ReturnType<typeof runAutofixAutoPasses>>)
      .mockRejectedValueOnce(new Error("auto pass failed"));

    await expect(applyManualFixAndRefresh(node.id, spellFix())).rejects.toThrow("auto pass failed");

    const autoCalls = trackAnalytics.mock.calls.filter((call) => call[0] === "auto_fix_complete");
    expect(autoCalls).toHaveLength(1);
    expect(autoCalls[0][1]).toMatchObject({
      found: 2,
      applied: 1,
      not_applied: 1,
      categories: { typography: 1 },
    });
    expect(JSON.stringify(autoCalls)).not.toContain("cian_branding");
  });

  it("пакет одного типа пишет слои по одному и делает один добор", async () => {
    const first = fakeTextNode("Все");
    first.id = "1:1";
    const second = fakeTextNode("не знает");
    second.id = "1:2";
    const nodes = new Map([
      [first.id, first],
      [second.id, second],
    ]);
    vi.stubGlobal("figma", {
      getNodeByIdAsync: vi.fn(async (id: string) => nodes.get(id) ?? null),
      currentPage: { selection: [first, second] },
    });
    vi.mocked(postCheckResultToUi).mockClear();
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async (_node, fixes) => fixes);

    const capital = confirmFix({
      fixId: "cap",
      before: "все",
      after: "Все",
      rule: {
        id: "cian-138-sentence-start-capitalize",
        category: "cian_editorial",
        message: "Заглавная",
        applyPolicy: "confirm",
        priority: 1,
      },
    });
    const other = confirmFix({
      fixId: "ne",
      before: "не знает",
      after: "незнает",
      to: 8,
      rule: {
        id: "orthography-ne-verb-split",
        category: "orthography",
        message: "Не с глаголом",
        applyPolicy: "confirm",
        priority: 1,
      },
    });

    await applyManualFixBatchAndRefresh([
      { nodeId: first.id, fix: capital },
      { nodeId: second.id, fix: other },
    ]);

    expect(applyTextFixesToTextNode).toHaveBeenCalledTimes(2);
    expect(vi.mocked(applyTextFixesToTextNode).mock.calls[0][1]).toHaveLength(1);
    expect(vi.mocked(applyTextFixesToTextNode).mock.calls[1][1]).toHaveLength(1);
    expect(runAutofixAutoPasses).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runAutofixAutoPasses).mock.calls[0][2]).toEqual({ reportProgress: false });
    expect(postCheckResultToUi).toHaveBeenCalledTimes(1);
  });

  it("повтор того же клика, пока первый ещё идёт, не шлёт вторую auto-дельту", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(applyTextFixesToTextNode).mockImplementation(async () => {
      await gate;
      node.characters = "Квартира";
      return [{} as never];
    });
    vi.mocked(runAutofixAutoPasses).mockImplementation(async () => ({
      report: autoReport([{ fixId: "nbsp", category: "typography" }]),
      finalScan: { summary: { foundFixes: 0 } },
    }) as Awaited<ReturnType<typeof runAutofixAutoPasses>>);

    const first = applyManualFixAndRefresh(node.id, spellFix());
    const second = applyManualFixAndRefresh(node.id, spellFix());
    release();
    await first;
    await second;

    expect(vi.mocked(runAutofixAutoPasses)).toHaveBeenCalledTimes(2);
    expect(trackAnalytics.mock.calls.filter((call) => call[0] === "auto_fix_complete")).toHaveLength(1);
    expect(trackAnalytics.mock.calls.filter((call) => call[0] === "manual_fix_complete")).toHaveLength(1);
  });
});
