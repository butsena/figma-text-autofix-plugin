import { afterEach, describe, expect, it } from "vitest";
import type { TextFixDto } from "../shared/messages";
import { renderChoiceFixRow } from "./ui-render-fix-row";
import { state } from "./ui-state";

function choiceFix(before: string, options: string[], ruleId: string): TextFixDto {
  return {
    fixId: "n1:0",
    from: 0,
    to: before.length,
    before,
    after: before,
    rule: {
      id: ruleId,
      category: "form_choice",
      message: ruleId === "cian-choice-vse-vsyo" ? "Выберите букву" : "Выберите форму глагола",
      hint: "подсказка",
      choiceOptions: options,
      priority: 78,
      applyPolicy: "choice",
    },
  };
}

afterEach(() => {
  state.choiceSelection = {};
});

describe("renderChoiceFixRow", () => {
  it("подсвечивает текущее всё и включает Подтвердить без клика", () => {
    const html = renderChoiceFixRow(
      choiceFix("всё", ["все", "всё"], "cian-choice-vse-vsyo"),
      0,
      0,
    );
    expect(html).toContain("choiceOptionSelected");
    expect(html).toMatch(
      /class="choiceOptionBtn choiceOptionSelected"[^>]*>всё<\/button>/,
    );
    expect(html).not.toMatch(
      /class="choiceOptionBtn choiceOptionSelected"[^>]*>все<\/button>/,
    );
    expect(html).toContain('data-choice-confirm="0:0">Подтвердить</button>');
    expect(html).not.toContain(" disabled>");
  });

  it("для ждете предвыбирает ждёте", () => {
    const html = renderChoiceFixRow(
      choiceFix("ждете", ["ждите", "ждёте"], "cian-choice-zhdite-zhdyote"),
      0,
      0,
    );
    expect(html).toMatch(
      /class="choiceOptionBtn choiceOptionSelected"[^>]*>ждёте<\/button>/,
    );
    expect(html).not.toContain(" disabled>");
  });

  it("клик пользователя перекрывает автовыбор", () => {
    state.choiceSelection["0:0"] = 0;
    const html = renderChoiceFixRow(
      choiceFix("всё", ["все", "всё"], "cian-choice-vse-vsyo"),
      0,
      0,
    );
    expect(html).toMatch(
      /class="choiceOptionBtn choiceOptionSelected"[^>]*>все<\/button>/,
    );
  });
});
