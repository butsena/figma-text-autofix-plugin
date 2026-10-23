import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextFixDto } from "../shared/messages";

const trackAnalytics = vi.fn();

vi.mock("../analytics/track", () => ({
  beginAnalyticsSession: vi.fn(() => "sess_test12345678"),
  resetAnalyticsSessionForTests: vi.fn(),
  trackAnalytics: (...args: unknown[]) => trackAnalytics(...args),
}));

vi.mock("./autofix-pipeline", () => ({
  runAutofixAutoPasses: vi.fn(async () => ({
    report: {
      summary: { checkedLayers: 0, appliedFixCount: 0, changedLayerCount: 0 },
      layers: [],
    },
  })),
}));

vi.mock("./check-result-session", async () => {
  const actual = await vi.importActual<typeof import("./check-result-session")>("./check-result-session");
  return {
    ...actual,
    postCheckResultToUi: vi.fn(),
  };
});

import { applyTextFixesToTextNode } from "./apply-fixes";
import { runAutofixAutoPasses } from "./autofix-pipeline";
import { applyManualFixAndRefresh, skipManualFixAndRefresh } from "./apply-manual-fix";

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

function installNode(node: FakeTextNode | null): void {
  vi.stubGlobal("figma", {
    getNodeByIdAsync: vi.fn(async () => node),
    currentPage: { selection: node ? [node] : [] },
  });
}

describe("applyManualFixAndRefresh", () => {
  beforeEach(() => {
    trackAnalytics.mockClear();
    vi.mocked(applyTextFixesToTextNode).mockReset();
    vi.mocked(runAutofixAutoPasses).mockClear();
  });

  it("обычная замена без изменения текста не считается успехом", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    const unchanged = confirmFix({ before: "Кватира", after: "Кватира", to: 7 });

    await applyManualFixAndRefresh(node.id, unchanged);

    expect(applyTextFixesToTextNode).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it("T-130 F01: пустой результат не увеличивает успешные изменения", async () => {
    const node = fakeTextNode("Кватира");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockResolvedValue([]);

    await applyManualFixAndRefresh(node.id, confirmFix());

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
    });
    expect(JSON.stringify(trackAnalytics.mock.calls)).not.toMatch(/Кватира|Квартира/);
  });

  it("нет слоя, устаревший фрагмент и исключение не пишут успех", async () => {
    installNode(null);
    await applyManualFixAndRefresh("missing", confirmFix());
    expect(trackAnalytics).not.toHaveBeenCalled();

    const stale = fakeTextNode("уже другое");
    installNode(stale);
    vi.mocked(applyTextFixesToTextNode).mockResolvedValue([]);
    await applyManualFixAndRefresh(stale.id, confirmFix());
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(runAutofixAutoPasses).toHaveBeenCalled();

    trackAnalytics.mockClear();
    vi.mocked(runAutofixAutoPasses).mockClear();
    const node = fakeTextNode("Кватира");
    installNode(node);
    vi.mocked(applyTextFixesToTextNode).mockRejectedValue(new Error("apply failed"));
    await expect(applyManualFixAndRefresh(node.id, confirmFix())).rejects.toThrow("apply failed");
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

    await applyManualFixAndRefresh(node.id, choiceFix("напишете"));

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
});
