import { afterEach, describe, expect, it } from "vitest";
import { ORTHOGRAPHY_SPELL_RULE_ID } from "../rules/orthography-spell-rules";
import type { TextFixDto } from "../shared/messages";
import {
  renderChoiceFixRow,
  renderFixRow,
  renderOrthographySpellFixRow,
} from "./ui-render-fix-row";
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

describe("renderFixRow", () => {
  it("confirm-строка с Исправить/Пропустить", () => {
    const html = renderFixRow(
      {
        ruleId: "cian-ty-vy",
        category: "cian_editorial",
        message: "Пишите «вы»",
        from: 0,
        to: 3,
        before: "Вы",
        after: "вы",
      },
      "Вы здесь",
      { cardIdx: 0, fixIdx: 1 },
    );
    expect(html).toContain("confirmApplyBtn");
    expect(html).toContain("confirmSkipBtn");
    expect(html).toContain('data-confirm-apply="0:1"');
    expect(html).toContain("Пишите «вы»");
    expect(html).toContain("Редполитика");
  });

  it("орфографию маршрутизирует в spell-рендер", () => {
    const html = renderFixRow(
      {
        ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
        category: "orthography",
        message: "Возможная опечатка",
        from: 0,
        to: 6,
        before: "ашыбка",
        after: "ошибка",
      },
      "ашыбка",
      { cardIdx: 2, fixIdx: 0 },
    );
    expect(html).toContain("spellInput");
    expect(html).toContain('data-spell-apply="2:0"');
    expect(html).not.toContain("data-confirm-apply");
  });
});

describe("renderOrthographySpellFixRow", () => {
  it("без suggestion дизейблит Исправить", () => {
    const html = renderOrthographySpellFixRow(
      {
        ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
        category: "orthography",
        message: "орф",
        before: "хххххх",
        after: "хххххх",
      },
      0,
      0,
    );
    expect(html).toContain("disabled");
    expect(html).toContain('value=""');
  });

  it("экранирует сообщение", () => {
    const html = renderOrthographySpellFixRow(
      {
        ruleId: ORTHOGRAPHY_SPELL_RULE_ID,
        category: "orthography",
        message: "<script>x</script>",
        before: "a&b",
        after: "ab",
      },
      1,
      2,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&amp;b");
  });
});

describe("renderChoiceFixRow", () => {
  it("подсвечивает текущее всё и включает Подтвердить без клика", () => {
    const html = renderChoiceFixRow(
      choiceFix("всё", ["все", "всё"], "cian-choice-vse-vsyo"),
      0,
      0,
    );
    expect(html).toContain("choiceOptionSelected");
    expect(html).toMatch(/class="choiceOptionBtn choiceOptionSelected"[^>]*>всё<\/button>/);
    expect(html).not.toMatch(/class="choiceOptionBtn choiceOptionSelected"[^>]*>все<\/button>/);
    expect(html).toContain('data-choice-confirm="0:0">Подтвердить</button>');
    expect(html).not.toContain(" disabled>");
  });

  it("для ждете предвыбирает ждёте", () => {
    const html = renderChoiceFixRow(
      choiceFix("ждете", ["ждите", "ждёте"], "cian-choice-zhdite-zhdyote"),
      0,
      0,
    );
    expect(html).toMatch(/class="choiceOptionBtn choiceOptionSelected"[^>]*>ждёте<\/button>/);
    expect(html).not.toContain(" disabled>");
  });

  it("клик пользователя перекрывает автовыбор", () => {
    state.choiceSelection["0:0"] = 0;
    const html = renderChoiceFixRow(
      choiceFix("всё", ["все", "всё"], "cian-choice-vse-vsyo"),
      0,
      0,
    );
    expect(html).toMatch(/class="choiceOptionBtn choiceOptionSelected"[^>]*>все<\/button>/);
  });

  it("рисует hintHtml и категорию", () => {
    const fix: TextFixDto = {
      fixId: "1",
      from: 0,
      to: 6,
      before: "ищите",
      after: "ищите",
      rule: {
        id: "cian-choice-ishchite-ishchete",
        category: "form_choice",
        message: "Выберите форму",
        priority: 1,
        applyPolicy: "choice",
        choiceOptions: ["ищите", "ищете"],
        hintHtml: '<div class="reportHint">hint</div>',
      },
    };
    const html = renderChoiceFixRow(fix, 0, 0);
    expect(html).toContain("choiceOptionBtn");
    expect(html).toContain("hint");
    expect(html).toContain("Выбор формы");
    expect(html).toContain("choiceOptionSelected");
  });
});
