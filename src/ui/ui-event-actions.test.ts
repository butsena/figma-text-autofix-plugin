import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextFixDto } from "../shared/messages";
import {
  applyConfirmFix,
  applySpellFix,
  confirmChoiceSelection,
  skipSpellFix,
} from "./ui-event-actions";
import { sendToPlugin } from "./ui-plugin-bridge";
import { state } from "./ui-state";

vi.mock("./ui-plugin-bridge", () => ({ sendToPlugin: vi.fn() }));
vi.mock("./ui-render", () => ({ render: vi.fn() }));

class FakeInput {
  constructor(public value: string) {}
}

function installFix(before = "Кватира", after = "Квартира"): TextFixDto {
  const fix: TextFixDto = {
    fixId: "spell-1",
    from: 0,
    to: before.length,
    before,
    after,
    rule: {
      id: "orthography-spellcheck",
      category: "orthography",
      message: "Опечатка",
      priority: 1,
      applyPolicy: "confirm",
    },
  };
  state.confirmCards = [{
    nodeId: "1:2",
    nodeName: "Слой",
    originalText: before,
    previewText: after,
    characterCount: before.length,
    fixes: [fix],
  }];
  return fix;
}

function inputValue(value: string): void {
  vi.stubGlobal("document", { querySelector: () => new FakeInput(value) });
}

describe("источник орфографии в UI", () => {
  beforeEach(() => {
    vi.mocked(sendToPlugin).mockClear();
    vi.stubGlobal("HTMLInputElement", FakeInput);
    state.confirmCards = [];
    state.choiceCards = [];
    state.choiceSelection = {};
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["Квартира", "Квартира", "suggested"],
    ["квартира", "Квартира", "suggested"],
    ["  КВАРТИРА  ", "КВАРТИРА", "suggested"],
    ["Квартирка", "Квартирка", "custom"],
  ])("сравнивает итоговую замену из ввода %j с исходной подсказкой", (typed, after, source) => {
    const fix = installFix();
    inputValue(typed);

    applySpellFix(0, 0);

    expect(sendToPlugin).toHaveBeenCalledOnce();
    expect(sendToPlugin).toHaveBeenCalledWith({
      type: "ui:applyManualFix",
      nodeId: "1:2",
      spellingSource: source,
      fix: { ...fix, after },
    });
    // Отправка не перезаписывает подсказку в живой карточке.
    expect(fix.after).toBe("Квартира");
  });

  it.each(["", "Кватира"])("без подсказки (%j) учитывает свой вариант", (suggested) => {
    installFix("Кватира", suggested);
    inputValue("Квартира");
    applySpellFix(0, 0);
    expect(sendToPlugin).toHaveBeenCalledWith(expect.objectContaining({ spellingSource: "custom" }));
  });

  it("сохраняет ведущий пробел и регистровое поведение replacementFromSpellInput", () => {
    installFix(",elbnt", " будут");
    inputValue("будут");
    applySpellFix(0, 0);
    expect(sendToPlugin).toHaveBeenCalledWith(expect.objectContaining({
      spellingSource: "suggested",
      fix: expect.objectContaining({ after: " будут" }),
    }));
  });

  it.each(["", "   ", "Кватира"])("пустой или неизменённый ввод %j не отправляет действие", (typed) => {
    installFix();
    inputValue(typed);
    applySpellFix(0, 0);
    expect(sendToPlugin).not.toHaveBeenCalled();
  });

  it("пропуск и обычное подтверждение не получают источник", () => {
    installFix();
    skipSpellFix(0, 0);
    applyConfirmFix(0, 0);
    for (const [message] of vi.mocked(sendToPlugin).mock.calls) {
      expect(message).not.toHaveProperty("spellingSource");
    }
  });

  it("choice не получает источник орфографии", () => {
    const fix = installFix("напишите", "напишете");
    fix.rule = { ...fix.rule, id: "choice-test", applyPolicy: "choice", choiceOptions: ["напишите", "напишете"] };
    state.choiceCards = state.confirmCards;
    state.choiceSelection["0:0"] = 1;
    confirmChoiceSelection(0, 0);
    expect(sendToPlugin).toHaveBeenCalledOnce();
    expect(vi.mocked(sendToPlugin).mock.calls[0][0]).not.toHaveProperty("spellingSource");
  });
});
