import { beforeEach, describe, expect, it, vi } from "vitest";
import { state } from "./ui-state";

vi.mock("./ui-resize", () => ({
  schedulePluginResize: vi.fn(),
}));

const app = { innerHTML: "" };

vi.stubGlobal("HTMLDetailsElement", class HTMLDetailsElement {});
vi.stubGlobal("document", {
  getElementById: (id: string) => (id === "app" ? app : null),
  querySelector: () => null,
});

const { render } = await import("./ui-render");

function fillBusyState(): void {
  state.summary = { checkedLayers: 1, foundFixes: 2, confirmFixes: 1, choiceFixes: 1 };
  state.spellcheckInProgress = true;
  state.lexiconLoad = null;
  state.checkedTextLayers = [{ nodeId: "1:1", nodeName: "Слой", characterCount: 8 }];
  state.cards = [
    {
      nodeId: "1:1",
      nodeName: "Слой",
      originalText: "ещё текст",
      previewText: "ещё текст",
      characterCount: 8,
      fixes: [],
    },
  ];
  state.choiceCards = state.cards;
  state.confirmCards = state.cards;
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
            ruleId: "cian-brand",
            category: "brand",
            message: "Циан",
            before: "ЦИАН",
            after: "Циан",
            from: 0,
            to: 4,
            sourceText: "ЦИАН",
          },
        ],
      },
    ],
  };
  state.lastManualReport = state.lastReport;
}

describe("render во время орфографии", () => {
  beforeEach(() => {
    app.innerHTML = "";
    fillBusyState();
  });

  it("пока плашка крутится, в DOM только она", () => {
    render();
    expect(app.innerHTML).toContain("Проверяю орфографию — пажжите...");
    expect(app.innerHTML).not.toContain("Выберите вариант");
    expect(app.innerHTML).not.toContain("Обратите внимание");
    expect(app.innerHTML).not.toContain("Исправлено автоматически");
    expect(app.innerHTML).not.toContain("Вы исправили");
    expect(app.innerHTML).not.toContain("Оставшиеся совпадения");
    expect(app.innerHTML).not.toContain("Техническая хрень");
    expect(app.innerHTML).not.toContain("Спасибо, шайтан-машина!");
    expect(app.innerHTML).not.toContain("Проверено слоёв");
  });

  it("после плашки возвращает choice, отчёты и «Спасибо»", () => {
    state.spellcheckInProgress = false;
    state.ui.manualReportDetailsOpen = false;
    render();
    expect(app.innerHTML).not.toContain("Проверяю орфографию — пажжите...");
    expect(app.innerHTML).toContain("Выберите вариант");
    expect(app.innerHTML).toContain("Обратите внимание");
    expect(app.innerHTML).toContain("Исправлено автоматически");
    expect(app.innerHTML).toContain("Вы исправили");
    expect(app.innerHTML).toContain('<details class="manualReportDetails">');
    expect(app.innerHTML).not.toContain('<details class="manualReportDetails" open>');
    expect(app.innerHTML).toContain("Оставшиеся совпадения");
    expect(app.innerHTML).toContain("Техническая хрень");
    expect(app.innerHTML).toContain("Спасибо, шайтан-машина!");
    expect(app.innerHTML).toContain("Проверено слоёв");
  });
});
