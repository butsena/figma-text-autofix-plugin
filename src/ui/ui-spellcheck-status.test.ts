import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderChoiceHtml,
  renderConfirmHtml,
  renderManualReportHtml,
  renderReportHtml,
  renderReportThanksHtml,
  renderResultHeaderHtml,
  renderSpellcheckStatusHtml,
  renderTechDetailsHtml,
  renderTextLayersHtml,
} from "./ui-render-sections";
import { applySpellcheckStatus, state } from "./ui-state";

describe("renderSpellcheckStatusHtml", () => {
  beforeEach(() => {
    state.spellcheckInProgress = false;
  });

  it("пусто, пока орфография не в процессе", () => {
    expect(renderSpellcheckStatusHtml()).toBe("");
  });

  it("рисует спиннер и текст «Проверяю орфографию — пажжите...»", () => {
    applySpellcheckStatus(true);
    const html = renderSpellcheckStatusHtml();
    expect(html).toContain("spellcheckStatus");
    expect(html).toContain("spellcheckSpinner");
    expect(html).toContain("Проверяю орфографию — пажжите...");
  });
});

describe("отчёт, пока орфография грузится", () => {
  beforeEach(() => {
    state.spellcheckInProgress = false;
    state.summary = { checkedLayers: 1, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 };
    state.lastManualReport = null;
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 0, changedLayerCount: 0 },
      layers: [],
    };
  });

  it("прячет «правок нет» и «Спасибо», пока идёт проверка", () => {
    applySpellcheckStatus(true);
    expect(renderReportHtml()).toBe("");
    expect(renderReportThanksHtml()).toBe("");
    expect(renderSpellcheckStatusHtml()).toContain("Проверяю орфографию — пажжите...");
  });

  it("после проверки показывает пустой отчёт и кнопку", () => {
    applySpellcheckStatus(false);
    expect(renderReportHtml()).toContain("В выделенных слоях правок нет");
    expect(renderReportThanksHtml()).toContain("Спасибо, шайтан-машина!");
    expect(renderSpellcheckStatusHtml()).toBe("");
  });

  it("пока идёт проверка, прячет авто-отчёт, choice, confirm, слои и техблок", () => {
    state.summary = { checkedLayers: 1, foundFixes: 1, confirmFixes: 1, choiceFixes: 1 };
    state.checkedTextLayers = [{ nodeId: "1:1", nodeName: "Слой", characterCount: 4 }];
    state.lexiconLoad = {
      replacements: { ok: true, count: 1, fromRemote: false },
      boundaryExceptions: { ok: true, count: 0, fromRemote: false },
      ambiguousFormChoices: { ok: true, count: 0, fromRemote: false },
      spellDictionary: { ok: true, count: 0, fromRemote: false },
      spellSupplement: { ok: true, count: 0, fromRemote: false },
      spellWhitelist: { ok: true, count: 0, fromRemote: false },
      spellExtraUniqueCount: 0,
    };
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 4,
          fixes: [
            {
              fixId: "a1",
              ruleId: "cian-yo",
              category: "yo_spelling",
              message: "ё",
              before: "еще",
              after: "ещё",
              from: 0,
              to: 3,
              sourceText: "еще",
            },
          ],
        },
      ],
    };
    state.lastManualReport = state.lastReport;
    state.choiceCards = [
      {
        nodeId: "1:1",
        nodeName: "Слой",
        originalText: "напишите мне",
        previewText: "напишите мне",
        characterCount: 12,
        fixes: [],
      },
    ];
    state.confirmCards = state.choiceCards;
    applySpellcheckStatus(true);
    expect(renderReportHtml()).toBe("");
    expect(renderManualReportHtml()).toBe("");
    expect(renderChoiceHtml()).toBe("");
    expect(renderConfirmHtml()).toBe("");
    expect(renderTextLayersHtml()).toBe("");
    expect(renderTechDetailsHtml()).toBe("");
    expect(renderReportThanksHtml()).toBe("");
    expect(renderResultHeaderHtml()).toBe("");
    expect(renderSpellcheckStatusHtml()).toContain("Проверяю орфографию — пажжите...");
  });

  it("после проверки авто-отчёт снова «Исправлено автоматически»", () => {
    state.summary = { checkedLayers: 1, foundFixes: 1, confirmFixes: 0, choiceFixes: 0 };
    state.lastReport = {
      summary: { checkedLayers: 1, appliedFixCount: 1, changedLayerCount: 1 },
      layers: [
        {
          nodeId: "1:1",
          nodeName: "Слой",
          characterCount: 4,
          fixes: [
            {
              fixId: "a1",
              ruleId: "cian-yo",
              category: "yo_spelling",
              message: "ё",
              before: "еще",
              after: "ещё",
              from: 0,
              to: 3,
              sourceText: "еще",
            },
          ],
        },
      ],
    };
    applySpellcheckStatus(false);
    expect(renderReportHtml()).toContain("Исправлено автоматически");
    expect(renderReportHtml()).not.toContain("Что исправлено автоматически");
  });
});

describe("handlePluginMessage spellcheckStatus", () => {
  beforeEach(() => {
    state.spellcheckInProgress = false;
    vi.resetModules();
  });

  it("включает и выключает статус по сообщению плагина", async () => {
    vi.doMock("./ui-render", () => ({
      render: vi.fn(),
      renderPluginError: vi.fn(),
    }));
    vi.doMock("./ui-events", () => ({ initUiEvents: vi.fn() }));
    vi.doMock("./ui-plugin-bridge", () => ({ sendToPlugin: vi.fn() }));

    const { handlePluginMessage } = await import("./ui-messages");
    const { state: liveState } = await import("./ui-state");

    handlePluginMessage({
      data: { pluginMessage: { type: "plugin:spellcheckStatus", active: true } },
    } as MessageEvent);
    expect(liveState.spellcheckInProgress).toBe(true);

    handlePluginMessage({
      data: { pluginMessage: { type: "plugin:spellcheckStatus", active: false } },
    } as MessageEvent);
    expect(liveState.spellcheckInProgress).toBe(false);
  });
});
