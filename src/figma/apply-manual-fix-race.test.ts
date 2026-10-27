import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextFix } from "../core/autofix-engine";
import type { TextFixDto } from "../shared/messages";
import { applyTextFixesToTextNode } from "./apply-fixes";
import { applyManualFixAndRefresh, resetManualApplyInFlightForTests } from "./apply-manual-fix";
import { readChoiceResolutions, shouldSuppressChoiceFix } from "./choice-resolution";

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
  return { ...actual, postCheckResultToUi: vi.fn() };
});

const FONT = { family: "Inter", style: "Regular" };

type FakeTextNode = {
  id: string;
  name: string;
  type: "TEXT";
  characters: string;
  parent: null;
  fontName: typeof FONT;
  getPluginData: (key: string) => string;
  setPluginData: (key: string, value: string) => void;
  getRangeAllFontNames: () => Array<typeof FONT>;
  getRangeFontName: () => typeof FONT;
  getRangeFontSize: () => number;
  getRangeFills: () => never[];
  getRangeLetterSpacing: () => { unit: "PERCENT"; value: number };
  getRangeLineHeight: () => { unit: "AUTO" };
  getRangeTextCase: () => "ORIGINAL";
  getRangeTextDecoration: () => "NONE";
  getRangeTextStyleId: () => "";
  getRangeFillStyleId: () => "";
  deleteCharacters: (from: number, to: number) => void;
  insertCharacters: (from: number, text: string) => void;
  setRangeFontName: () => void;
  setRangeFontSize: () => void;
  setRangeFills: () => void;
  setRangeLetterSpacing: () => void;
  setRangeLineHeight: () => void;
  setRangeTextCase: () => void;
  setRangeTextDecoration: () => void;
  setRangeTextStyleIdAsync: () => Promise<void>;
  setRangeFillStyleIdAsync: () => Promise<void>;
};

function fakeTextNode(id: string, characters: string): FakeTextNode {
  const data = new Map<string, string>();
  const node: FakeTextNode = {
    id,
    name: "Слой",
    type: "TEXT",
    characters,
    parent: null,
    fontName: FONT,
    getPluginData: (key) => data.get(key) ?? "",
    setPluginData: (key, value) => {
      data.set(key, value);
    },
    getRangeAllFontNames: () => [FONT],
    getRangeFontName: () => FONT,
    getRangeFontSize: () => 16,
    getRangeFills: () => [],
    getRangeLetterSpacing: () => ({ unit: "PERCENT", value: 0 }),
    getRangeLineHeight: () => ({ unit: "AUTO" }),
    getRangeTextCase: () => "ORIGINAL",
    getRangeTextDecoration: () => "NONE",
    getRangeTextStyleId: () => "",
    getRangeFillStyleId: () => "",
    deleteCharacters(from, to) {
      this.characters = this.characters.slice(0, from) + this.characters.slice(to);
    },
    insertCharacters(from, text) {
      this.characters = this.characters.slice(0, from) + text + this.characters.slice(from);
    },
    setRangeFontName: () => undefined,
    setRangeFontSize: () => undefined,
    setRangeFills: () => undefined,
    setRangeLetterSpacing: () => undefined,
    setRangeLineHeight: () => undefined,
    setRangeTextCase: () => undefined,
    setRangeTextDecoration: () => undefined,
    setRangeTextStyleIdAsync: async () => undefined,
    setRangeFillStyleIdAsync: async () => undefined,
  };
  return node;
}

function spellEngineFix(): TextFix {
  return {
    from: 0,
    to: 7,
    before: "Кватира",
    after: "Квартира",
    ruleId: "orthography-spellcheck",
    category: "orthography",
    message: "Опечатка",
    priority: 1,
    applyPolicy: "confirm",
  };
}

function spellDto(): TextFixDto {
  return {
    fixId: "spell-1",
    from: 0,
    to: 7,
    before: "Кватира",
    after: "Квартира",
    rule: {
      id: "orthography-spellcheck",
      category: "orthography",
      message: "Опечатка",
      applyPolicy: "confirm",
      priority: 1,
    },
  };
}

function choiceDto(before: string, after: string): TextFixDto {
  return {
    fixId: "choice-1",
    from: 0,
    to: before.length,
    before,
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

describe("повтор ручного применения на настоящем apply", () => {
  beforeEach(() => {
    trackAnalytics.mockClear();
    resetManualApplyInFlightForTests();
    vi.stubGlobal("figma", {
      mixed: Symbol("mixed"),
      loadFontAsync: vi.fn(async () => undefined),
      getNodeByIdAsync: vi.fn(),
      currentPage: { selection: [] },
    });
  });

  it("две загрузки шрифта не превращают «Кватира» в «Квартираа»", async () => {
    const node = fakeTextNode("1:2", "Кватира");
    let stage: "node" | "range" | "open" = "node";
    const nodeWaiters: Array<() => void> = [];
    const rangeWaiters: Array<() => void> = [];
    vi.mocked(figma.loadFontAsync).mockImplementation(async () => {
      if (stage === "open") return;
      if (stage === "node") {
        await new Promise<void>((resolve) => nodeWaiters.push(resolve));
        return;
      }
      await new Promise<void>((resolve) => rangeWaiters.push(resolve));
    });

    const first = applyTextFixesToTextNode(node as unknown as TextNode, [spellEngineFix()]);
    const second = applyTextFixesToTextNode(node as unknown as TextNode, [spellEngineFix()]);
    await vi.waitFor(() => expect(nodeWaiters.length).toBe(2));

    stage = "range";
    nodeWaiters.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(rangeWaiters.length).toBe(2));

    stage = "open";
    rangeWaiters.splice(0).forEach((release) => release());
    const [appliedA, appliedB] = await Promise.all([first, second]);

    expect(node.characters).toBe("Квартира");
    expect(appliedA.length + appliedB.length).toBe(1);
  });

  it("повтор того же клика ждёт первую операцию и пишет один успех", async () => {
    const node = fakeTextNode("1:2", "Кватира");
    let releaseFont: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFont = resolve;
    });
    let fontCalls = 0;
    vi.mocked(figma.loadFontAsync).mockImplementation(async () => {
      fontCalls += 1;
      if (fontCalls === 1) await gate;
    });
    vi.mocked(figma.getNodeByIdAsync).mockImplementation(async () => node as unknown as TextNode);
    figma.currentPage.selection = [node as unknown as TextNode];

    const first = applyManualFixAndRefresh(node.id, spellDto());
    const second = applyManualFixAndRefresh(node.id, spellDto());
    await vi.waitFor(() => expect(fontCalls).toBeGreaterThan(0));
    await Promise.resolve();
    expect(fontCalls).toBe(1);

    releaseFont();
    await Promise.all([first, second]);

    expect(node.characters).toBe("Квартира");
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("manual_fix_complete", {
      action: "applied",
      kind: "orthography",
    });
  });

  it("другой слой не ждёт чужую ручную операцию", async () => {
    const firstNode = fakeTextNode("1:2", "Кватира");
    const other = fakeTextNode("1:3", "Другой");
    let releaseFont: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFont = resolve;
    });
    const seen = new Set<string>();
    vi.mocked(figma.loadFontAsync).mockImplementation(async () => {
      seen.add("font");
      if (!releaseFont) return;
      await gate;
    });
    vi.mocked(figma.getNodeByIdAsync).mockImplementation(async (id: string) => {
      seen.add(id);
      return (id === other.id ? other : firstNode) as unknown as TextNode;
    });
    figma.currentPage.selection = [firstNode as unknown as TextNode];

    const blocked = applyManualFixAndRefresh(firstNode.id, spellDto());
    await vi.waitFor(() => expect(seen.has("font")).toBe(true));

    let otherStarted = false;
    const otherRun = applyManualFixAndRefresh(other.id, {
      ...spellDto(),
      fixId: "other",
      before: "Другой",
      after: "Другая",
      to: 6,
      rule: { ...spellDto().rule, id: "other-rule" },
    }).then(() => {
      otherStarted = true;
    });
    await vi.waitFor(() => expect(seen.has(other.id)).toBe(true));
    expect(otherStarted).toBe(false);

    releaseFont();
    await Promise.all([blocked, otherRun]);
    expect(otherStarted).toBe(true);
    expect(firstNode.characters).toBe("Квартира");
  });

  it("устаревший choice не сохраняет решение и не прячет вопрос", async () => {
    const node = fakeTextNode("1:4", "напишете мне");
    vi.mocked(figma.getNodeByIdAsync).mockResolvedValue(node as unknown as TextNode);
    figma.currentPage.selection = [node as unknown as TextNode];

    await applyManualFixAndRefresh(node.id, choiceDto("напишите", "напишете"));

    expect(node.characters).toBe("напишете мне");
    expect(readChoiceResolutions(node as unknown as TextNode)).toEqual([]);
    expect(
      shouldSuppressChoiceFix(
        node.characters,
        { ruleId: "cian-choice-napishite", from: 0, to: 8, before: "напишете" },
        [],
      ),
    ).toBe(false);
    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it("исходная форма сохраняется, ошибка записи не подтверждает решение", async () => {
    const node = fakeTextNode("1:5", "напишите мне");
    vi.mocked(figma.getNodeByIdAsync).mockResolvedValue(node as unknown as TextNode);
    figma.currentPage.selection = [node as unknown as TextNode];

    await applyManualFixAndRefresh(node.id, choiceDto("напишите", "напишите"));
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("choice_resolved", { action: "confirmed" });
    expect(
      shouldSuppressChoiceFix(
        node.characters,
        { ruleId: "cian-choice-napishite", from: 0, to: 8, before: "напишите" },
        readChoiceResolutions(node as unknown as TextNode),
      ),
    ).toBe(true);

    trackAnalytics.mockClear();
    resetManualApplyInFlightForTests();
    const broken = fakeTextNode("1:6", "напишите мне");
    broken.setPluginData = () => {
      throw new Error("plugin data");
    };
    vi.mocked(figma.getNodeByIdAsync).mockResolvedValue(broken as unknown as TextNode);
    await expect(applyManualFixAndRefresh(broken.id, choiceDto("напишите", "напишите"))).rejects.toThrow(
      "plugin data",
    );
    expect(trackAnalytics).not.toHaveBeenCalled();
  });
});
