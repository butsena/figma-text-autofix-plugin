import { beforeEach, describe, expect, it } from "vitest";
import type { TextNodeCardDto } from "../shared/messages";
import {
  applyCheckResult,
  applyLexiconConfig,
  applySpellcheckStatus,
  choiceSelectionKey,
  mapTextNodeCard,
  resetForError,
  state,
  detailsStateSelector,
  readDetailsOpen,
  syncAccordionStateFromElement,
} from "./ui-state";

const sampleCard: TextNodeCardDto = {
  nodeId: "1:1",
  nodeName: "Заголовок",
  originalText: "текст",
  previewText: "текст",
  characterCount: 5,
  fixes: [],
};

describe("ui-state", () => {
  beforeEach(() => {
    resetForError();
    state.confirmCards = [];
    state.choiceCards = [];
    state.lexiconLoad = null;
    state.spellcheckInProgress = false;
    state.choiceSelection = {};
    state.ui.confirmDetailsOpen = true;
    state.ui.techDetailsOpen = false;
  });

  it("«Вы исправили» свёрнут по умолчанию", () => {
    expect(state.ui.manualReportDetailsOpen).toBe(false);
  });

  it("choiceSelectionKey собирает ключ", () => {
    expect(choiceSelectionKey(2, 3)).toBe("2:3");
  });

  it("mapTextNodeCard копирует поля карточки", () => {
    expect(mapTextNodeCard(sampleCard)).toEqual(sampleCard);
  });

  it("applyCheckResult заполняет state и сбрасывает choiceSelection", () => {
    state.choiceSelection = { "0:0": 1 };
    applyCheckResult({
      summary: { checkedLayers: 1, foundFixes: 0, confirmFixes: 1, choiceFixes: 0 },
      checkedTextLayers: [{ nodeId: "1:1", nodeName: "A", characterCount: 5 }],
      lastAutoApplyReport: null,
      lastManualApplyReport: null,
      cards: [sampleCard],
      confirmCards: [sampleCard],
      choiceCards: [],
    });
    expect(state.choiceSelection).toEqual({});
    expect(state.summary?.checkedLayers).toBe(1);
    expect(state.cards).toHaveLength(1);
    expect(state.confirmCards).toHaveLength(1);
    expect(state.checkedTextLayers[0]?.nodeName).toBe("A");
  });

  it("applyLexiconConfig сохраняет статус словарей", () => {
    applyLexiconConfig({
      replacements: { ok: true, count: 10, fromRemote: true },
      boundaryExceptions: { ok: true, count: 1, fromRemote: false },
      ambiguousFormChoices: { ok: true, count: 2, fromRemote: true },
      spellDictionary: { ok: true, count: 0, fromRemote: false },
      spellSupplement: { ok: true, count: 0, fromRemote: false },
      spellWhitelist: { ok: true, count: 0, fromRemote: false },
      spellExtraUniqueCount: 0,
    });
    expect(state.lexiconLoad?.replacements.count).toBe(10);
  });

  it("applySpellcheckStatus и resetForError управляют индикатором орфографии", () => {
    applySpellcheckStatus(true);
    expect(state.spellcheckInProgress).toBe(true);
    resetForError();
    expect(state.spellcheckInProgress).toBe(false);
  });

  it("resetForError чистит summary/cards/report", () => {
    applyCheckResult({
      summary: { checkedLayers: 1, foundFixes: 1, confirmFixes: 0, choiceFixes: 0 },
      checkedTextLayers: [],
      lastAutoApplyReport: {
        summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
        layers: [],
      },
      lastManualApplyReport: {
        summary: { checkedLayers: 1, appliedFixCount: 2, changedLayerCount: 1 },
        layers: [],
      },
      cards: [sampleCard],
      confirmCards: [],
      choiceCards: [],
    });
    resetForError();
    expect(state.summary).toBeNull();
    expect(state.cards).toEqual([]);
    expect(state.lastReport).toBeNull();
    expect(state.lastManualReport).toBeNull();
  });

  it("закрытие смотрит флаг секции, даже если DOM уже переключён", () => {
    state.ui.manualReportDetailsOpen = true;
    state.ui.reportDetailsOpen = true;
    const manual = {
      classList: { contains: (name: string) => name === "manualReportDetails" },
      open: false,
    } as unknown as HTMLDetailsElement;
    const report = {
      classList: { contains: (name: string) => name === "reportDetails" },
      open: false,
    } as unknown as HTMLDetailsElement;
    expect(readDetailsOpen(manual)).toBe(true);
    expect(readDetailsOpen(report)).toBe(true);
    expect(detailsStateSelector(manual)).toBe("details.manualReportDetails");
    expect(detailsStateSelector(report)).toBe("details.reportDetails");
    expect(detailsStateSelector({ classList: { contains: () => false } } as unknown as Element)).toBeNull();
    expect(readDetailsOpen({ classList: { contains: () => false } } as unknown as Element)).toBeNull();
  });

  it("syncAccordionStateFromElement обновляет флаги details", () => {
    const el = {
      classList: { contains: (name: string) => name === "techDetails" },
      open: true,
    } as unknown as HTMLDetailsElement;
    syncAccordionStateFromElement(el);
    expect(state.ui.techDetailsOpen).toBe(true);
  });
});
