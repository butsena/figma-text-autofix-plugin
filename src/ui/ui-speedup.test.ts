import { beforeEach, describe, expect, it } from "vitest";
import type { TextNodeCardDto } from "../shared/messages";
import { FIX_CARD_PAGE } from "./list-window";
import { renderChoiceHtml, renderConfirmHtml, renderResultHeaderHtml } from "./ui-render-sections";
import { state } from "./ui-state";

function rule(id: string, message: string, applyPolicy: "confirm" | "choice" = "confirm") {
  return {
    id,
    category: "cian_editorial",
    message,
    priority: 1,
    applyPolicy,
    ...(applyPolicy === "choice" ? { choiceOptions: ["пишите", "пишете"] } : {}),
  };
}

function card(nodeId: string, ruleId: string, message: string, before: string, after: string, applyPolicy: "confirm" | "choice" = "confirm"): TextNodeCardDto {
  return {
    nodeId,
    nodeName: nodeId,
    originalText: before,
    characterCount: before.length,
    fixes: [
      {
        fixId: `${nodeId}:${ruleId}`,
        from: 0,
        to: before.length,
        before,
        after,
        rule: rule(ruleId, message, applyPolicy),
      },
    ],
  };
}

describe("ускорение панели", () => {
  beforeEach(() => {
    state.summary = null;
    state.autofixProgress = null;
    state.spellcheckInProgress = false;
    state.confirmCards = [];
    state.choiceCards = [];
    state.expandedGroups = {};
    state.ui.confirmDetailsOpen = true;
    state.ui.choiceDetailsOpen = true;
  });

  it("полоска стоит под «Шуршу по макету…» и исчезает с результатом", () => {
    state.autofixProgress = { phase: "lexicon", applied: 0, total: 0 };
    const lexicon = renderResultHeaderHtml();
    expect(lexicon).toContain("Шуршу по макету…");
    expect(lexicon.indexOf("Шуршу по макету…")).toBeLessThan(lexicon.indexOf("Освежаю редполитику"));
    expect(lexicon).not.toContain("Обновляю словарь");

    state.autofixProgress = { phase: "spell", applied: 0, total: 0 };
    expect(renderResultHeaderHtml()).toContain("Обновляю словарь");

    state.autofixProgress = { phase: "apply", applied: 2, total: 5 };
    const apply = renderResultHeaderHtml();
    expect(apply).toContain("Исправляю тексты — 2");
    expect(apply).toContain("2 / 5");

    state.summary = { checkedLayers: 1, foundFixes: 0, confirmFixes: 0, choiceFixes: 0 };
    state.autofixProgress = null;
    const done = renderResultHeaderHtml();
    expect(done).not.toContain("Шуршу по макету…");
    expect(done).not.toContain("resultProgress");
  });

  it("confirm показывает прежние карточки на своих слоях", () => {
    state.confirmCards = [
      card("1:1", "cian-138-sentence-start-capitalize", "Заглавная в начале", "дом", "Дом"),
      card("1:2", "cian-138-numbered-list-capitalize", "Заглавная в списке", "два", "Два"),
      card("1:3", "cian-yo-homograph-vse", "все или всё", "все", "всё"),
      card("1:4", "cian-yo-homograph-esche", "еще или ещё", "еще", "ещё"),
      card("1:5", "orthography-ne-verb-split", "Не с глаголом", "не знает", "незнает"),
      card("1:6", "orthography-spellcheck", "Опечатка", "перд", "перед"),
    ];

    const html = renderConfirmHtml();
    expect(html).toContain("Обратите внимание");
    expect(html).toContain('class="confirmFix"');
    expect(html).toContain('data-node-id="1:1"');
    expect(html).toContain('data-confirm-apply="0:0"');
    expect(html).toContain('data-confirm-apply="1:0"');
    expect(html).not.toContain("Применить все");
    expect(html).not.toContain("Разобрать");
    expect(html).not.toContain("fixRemainder");
    expect(html.match(/data-confirm-apply=/g)).toHaveLength(5);
    expect(html).toContain('data-spell-apply="5:0"');

    state.ui.confirmDetailsOpen = false;
    expect(renderConfirmHtml()).not.toContain('class="confirmFix"');
  });

  it("похожие карточки рисуются по 10 и остаются на своём слое", () => {
    state.confirmCards = Array.from({ length: 12 }, (_, index) =>
      card(`1:${index + 1}`, "cian-138-sentence-start-capitalize", "Заглавная в начале", `слово${index}`, `Слово${index}`),
    );

    const html = renderConfirmHtml();
    expect(html.match(/class="confirmFix"/g)).toHaveLength(FIX_CARD_PAGE);
    expect(html).toContain('data-confirm-apply="0:0"');
    expect(html).toContain('data-confirm-apply="9:0"');
    expect(html).not.toContain('data-confirm-apply="10:0"');
    expect(html).not.toContain("слово10");
    expect(html).toContain('data-node-id="1:1"');
    expect(html).toContain('data-more-group="confirm:sentence-cap"');
    expect(html).toContain("Показать ещё 2");
    expect(html).toContain("10 / 12 кейсов");
    expect(html.indexOf("10 / 12 кейсов")).toBeLessThan(html.indexOf('data-confirm-apply="0:0"'));
    expect(html.indexOf('data-confirm-apply="9:0"')).toBeLessThan(html.indexOf("Показать ещё 2"));

    state.expandedGroups["confirm:sentence-cap"] = FIX_CARD_PAGE * 2;
    const open = renderConfirmHtml();
    expect(open).toContain('data-confirm-apply="11:0"');
    expect(open).toContain("слово11");
    expect(open).not.toContain("Показать ещё");
    expect(open).not.toContain("fixRemainder");
  });

  it("полоска сверху, а «Показать ещё» под карточками другого типа", () => {
    state.confirmCards = [
      ...Array.from({ length: 12 }, (_, index) =>
        card(
          `1:${index + 1}`,
          "cian-138-sentence-start-capitalize",
          "Заглавная в начале",
          `слово${index}`,
          `Слово${index}`,
        ),
      ),
      card("9:1", "cian-139a-implicit-sentence-period", "Пропущена точка", "Главное", "Главное."),
    ];

    const html = renderConfirmHtml();
    const barAt = html.indexOf("11 / 13 кейсов");
    const firstCard = html.indexOf('data-confirm-apply="0:0"');
    const otherCard = html.indexOf("Главное");
    const moreAt = html.indexOf("Показать ещё 2");
    expect(barAt).toBeGreaterThan(-1);
    expect(barAt).toBeLessThan(firstCard);
    expect(firstCard).toBeLessThan(otherCard);
    expect(otherCard).toBeLessThan(moreAt);
  });

  it("«Показать ещё» открывает 10, полоска choice с 11-й карточки одного типа", () => {
    state.confirmCards = Array.from({ length: 110 }, (_, index) =>
      card(`1:${index + 1}`, "cian-138-sentence-start-capitalize", "Заглавная", `слово${index}`, `Слово${index}`),
    );
    const confirm = renderConfirmHtml();
    expect(confirm).toContain("Показать ещё 10");
    expect(confirm).toContain("10 / 110 кейсов");

    state.confirmCards = [];
    state.choiceCards = Array.from({ length: 10 }, (_, index) =>
      card(`2:${index + 1}`, "cian-choice-pishite", "пишите или пишете", "пишите", "пишите", "choice"),
    );
    expect(renderChoiceHtml()).not.toContain("fixRemainder");

    state.choiceCards = Array.from({ length: 11 }, (_, index) =>
      card(`2:${index + 1}`, "cian-choice-pishite", "пишите или пишете", "пишите", "пишите", "choice"),
    );
    const choice = renderChoiceHtml();
    expect(choice).toContain("10 / 11 кейсов");
    expect(choice).toContain("Показать ещё 1");
  });

  it("choice остаётся отдельным блоком и без «Применить все»", () => {
    state.choiceCards = [
      card("2:1", "cian-choice-pishite", "пишите или пишете", "пишите", "пишите", "choice"),
      card("2:2", "cian-choice-pishite", "пишите или пишете", "Пишите", "Пишите", "choice"),
      card("2:3", "cian-choice-ishchite", "ищите или ищете", "ищите", "ищите", "choice"),
    ];

    const html = renderChoiceHtml();
    expect(html).toContain("Выберите вариант");
    expect(html.match(/class="choiceFix"/g)).toHaveLength(3);
    expect(html).toContain('data-node-id="2:1"');
    expect(html).toContain('data-choice-confirm="0:0"');
    expect(html).toContain('data-choice-confirm="2:0"');
    expect(html).not.toContain("Применить все");
    expect(html).not.toContain("fixRemainder");
  });
});
