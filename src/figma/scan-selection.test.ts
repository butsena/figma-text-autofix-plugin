import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextFix } from "../core/autofix-engine";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";

const collectMock = vi.fn();
const checkTextMock = vi.fn();
const filterUnresolvedMock = vi.fn((node: TextNode, fixes: TextFix[]) => fixes);
const getRulesMock = vi.fn(() => []);

vi.mock("./collect-text-nodes", () => ({
  collectTextNodesFromSelection: (...args: unknown[]) => collectMock(...args),
}));

vi.mock("./scan-text-check", async () => {
  const actual = await vi.importActual<typeof import("./scan-text-check")>("./scan-text-check");
  return {
    ...actual,
    checkTextWithSpelling: (...args: unknown[]) => checkTextMock(...args),
    filterRulesByPolicy: actual.filterRulesByPolicy,
  };
});

vi.mock("./scan-fix-dto", async () => {
  const actual = await vi.importActual<typeof import("./scan-fix-dto")>("./scan-fix-dto");
  return {
    ...actual,
    filterUnresolvedChoiceFixes: (...args: unknown[]) =>
      filterUnresolvedMock(...(args as [TextNode, TextFix[]])),
  };
});

vi.mock("../rules/autofix-rules", () => ({
  getAutofixRules: () => getRulesMock(),
}));

function fix(partial: Partial<TextFix> & Pick<TextFix, "from" | "to" | "before" | "after" | "ruleId">): TextFix {
  return {
    category: "test",
    message: "msg",
    priority: 50,
    applyPolicy: "auto",
    ...partial,
  };
}

function textNode(id: string, characters: string): TextNode {
  return { id, name: id, characters, type: "TEXT" } as unknown as TextNode;
}

describe("scanSelectedTextNodes", () => {
  beforeEach(() => {
    collectMock.mockReset();
    checkTextMock.mockReset();
    filterUnresolvedMock.mockReset();
    filterUnresolvedMock.mockImplementation((_node: TextNode, fixes: TextFix[]) => fixes);
    getRulesMock.mockReset();
    getRulesMock.mockReturnValue([]);
  });

  it("пустая выборка → пустые карточки", async () => {
    collectMock.mockReturnValue([]);
    const { scanSelectedTextNodes } = await import("./scan-selection");
    const { result } = scanSelectedTextNodes([]);
    expect(result.summary).toEqual({
      checkedLayers: 0,
      foundFixes: 0,
      confirmFixes: 0,
      choiceFixes: 0,
    });
    expect(result.cards).toEqual([]);
    expect(result.confirmCards).toEqual([]);
    expect(result.choiceCards).toEqual([]);
  });

  it("policy auto раскладывает auto/confirm/choice", async () => {
    const node = textNode("1:1", "текст");
    collectMock.mockReturnValue([node]);
    checkTextMock.mockReturnValue([
      fix({ from: 0, to: 1, before: "т", after: "Т", ruleId: "auto-1", applyPolicy: "auto", priority: 10 }),
      fix({
        from: 2,
        to: 3,
        before: "к",
        after: "К",
        ruleId: "confirm-1",
        applyPolicy: "confirm",
        priority: 20,
      }),
      fix({
        from: 4,
        to: 5,
        before: "т",
        after: "т",
        ruleId: "choice-1",
        applyPolicy: "choice",
        priority: 30,
        choiceOptions: ["т", "Т"],
      }),
    ]);

    const { scanSelectedTextNodes } = await import("./scan-selection");
    const { result } = scanSelectedTextNodes([node], { policy: "auto" });

    expect(result.summary.foundFixes).toBe(1);
    expect(result.summary.confirmFixes).toBe(1);
    expect(result.summary.choiceFixes).toBe(1);
    expect(result.cards).toHaveLength(1);
    expect(result.confirmCards).toHaveLength(1);
    expect(result.choiceCards).toHaveLength(1);
    expect(filterUnresolvedMock).toHaveBeenCalled();
  });

  it("policy confirm фильтрует только орфографию через unresolved", async () => {
    const node = textNode("1:1", "текст");
    collectMock.mockReturnValue([node]);
    checkTextMock.mockReturnValue([
      fix({
        from: 0,
        to: 5,
        before: "текст",
        after: "Текс",
        ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
        applyPolicy: "confirm",
        priority: 72,
      }),
      fix({
        from: 1,
        to: 2,
        before: "е",
        after: "Е",
        ruleId: "cian-ty-vy",
        applyPolicy: "confirm",
        priority: 50,
      }),
    ]);
    filterUnresolvedMock.mockImplementation((_n, fixes) =>
      fixes.filter((f) => f.ruleId !== ORTHOGRAPHY_SPELL_RULE_ID),
    );

    const { scanSelectedTextNodes } = await import("./scan-selection");
    const { result } = scanSelectedTextNodes([node], { policy: "confirm" });

    expect(result.cards).toEqual([]);
    expect(result.choiceCards).toEqual([]);
    expect(result.confirmCards).toHaveLength(1);
    expect(result.confirmCards[0]?.fixes.map((f) => f.rule.id)).toEqual(["cian-ty-vy"]);
    expect(result.summary.confirmFixes).toBe(1);
    expect(result.summary.foundFixes).toBe(0);
  });

  it("policy choice кладёт карточки только в choiceCards", async () => {
    const node = textNode("1:1", "ищите");
    collectMock.mockReturnValue([node]);
    checkTextMock.mockReturnValue([
      fix({
        from: 0,
        to: 6,
        before: "ищите",
        after: "ищите",
        ruleId: "cian-choice-ishchite-ishchete",
        applyPolicy: "choice",
        choiceOptions: ["ищите", "ищете"],
      }),
    ]);

    const { scanSelectedTextNodes } = await import("./scan-selection");
    const { result } = scanSelectedTextNodes([node], { policy: "choice" });

    expect(result.cards).toEqual([]);
    expect(result.confirmCards).toEqual([]);
    expect(result.choiceCards).toHaveLength(1);
    expect(result.summary.choiceFixes).toBe(1);
  });
});
