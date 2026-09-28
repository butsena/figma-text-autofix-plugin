import { beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];

vi.mock("../config/feature-flags", () => ({
  SPELLCHECK_ENABLED: true,
}));

vi.mock("../lexicon/refresh-lexicon", () => ({
  refreshSpellLexiconFromRemote: vi.fn(async () => {
    order.push("spell-lexicon");
    return { spellDictionary: { ok: true, count: 1, fromRemote: true } };
  }),
  refreshLexiconFromRemote: vi.fn(async () => {
    order.push("editorial-lexicon");
    return { replacements: { ok: true, count: 1, fromRemote: false } };
  }),
}));

vi.mock("../spell/spell-checker", () => ({
  ensureSpellCheckerReady: vi.fn(async () => {
    order.push("spell-ready");
    return null;
  }),
}));

vi.mock("./apply-fixes", () => ({
  applyFixesFromScan: vi.fn(),
}));

vi.mock("./scan-selection", () => ({
  scanSelectedTextNodes: vi.fn((_selection: unknown, options?: { includeSpelling?: boolean }) => {
    order.push(options?.includeSpelling === false ? "scan-without-spelling" : "scan-with-spelling");
    return {
      result: {
        summary: { checkedLayers: 1, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 },
        checkedTextLayers: [],
        cards: [],
        confirmCards: [],
        choiceCards: [],
      },
      nodeById: new Map(),
    };
  }),
}));

const messages: Array<{ type: string; active?: boolean }> = [];

function installFigma(): void {
  vi.stubGlobal("figma", {
    currentPage: { selection: [] },
    notify: vi.fn(),
    ui: {
      postMessage: (message: { type: string; active?: boolean }) => {
        messages.push({ type: message.type, active: message.active });
        order.push(`ui:${message.type}${message.active === undefined ? "" : `:${message.active}`}`);
      },
    },
  });
}

describe("runAutofixPipeline", () => {
  beforeEach(() => {
    order.length = 0;
    messages.length = 0;
    installFigma();
    vi.clearAllMocks();
  });

  it("сначала орфография, один отчёт, чужой UI не уходит раньше плашки", async () => {
    const { runAutofixPipeline } = await import("./autofix-pipeline");
    await runAutofixPipeline();

    expect(order.indexOf("spell-lexicon")).toBeLessThan(order.indexOf("editorial-lexicon"));
    expect(order.indexOf("spell-ready")).toBeLessThan(order.indexOf("scan-without-spelling"));
    expect(order.indexOf("ui:plugin:spellcheckStatus:true")).toBeLessThan(
      order.indexOf("scan-with-spelling"),
    );
    expect(order.indexOf("scan-with-spelling")).toBeLessThan(
      order.indexOf("ui:plugin:spellcheckStatus:false"),
    );

    const types = messages.map((message) =>
      message.type === "plugin:spellcheckStatus" ? `${message.type}:${message.active}` : message.type,
    );
    expect(types[0]).toBe("plugin:spellcheckStatus:true");
    expect(types.filter((type) => type === "plugin:checkResult")).toEqual(["plugin:checkResult"]);
    expect(types.at(-1)).toBe("plugin:spellcheckStatus:false");
    expect(types.indexOf("plugin:checkResult")).toBeGreaterThan(0);
    expect(types.indexOf("plugin:checkResult")).toBeLessThan(types.length - 1);
  });

  it("если словарь орфографии упал, остальные правила всё равно уходят в UI", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { refreshSpellLexiconFromRemote } = await import("../lexicon/refresh-lexicon");
    vi.mocked(refreshSpellLexiconFromRemote).mockRejectedValueOnce(new Error("hunspell down"));

    const { runAutofixPipeline } = await import("./autofix-pipeline");
    await runAutofixPipeline();

    expect(warn).toHaveBeenCalled();
    expect(order).toContain("editorial-lexicon");
    expect(order).toContain("ui:plugin:checkResult");
    expect(messages.at(-1)).toEqual({ type: "plugin:spellcheckStatus", active: false });
    warn.mockRestore();
  });
});
