import { describe, expect, it } from "vitest";
import {
  formatChoiceHintHtml,
  formatFixCategoryLabel,
  formatLayerTitleHtml,
  formatTextLayersBlockHtml,
  isChoiceRuleWithoutSkip,
  renderTechDetailsBodyHtml,
} from "./ui-helpers";
import type { LexiconLoadStatusDto } from "../shared/messages";

describe("formatFixCategoryLabel", () => {
  it("показывает Редполитику для правил про точки", () => {
    expect(formatFixCategoryLabel("cian_editorial", "cian-139-sentence-terminal-period")).toBe(
      "Редполитика",
    );
    expect(formatFixCategoryLabel("cian_editorial", "cian-139a-implicit-sentence-period")).toBe(
      "Редполитика",
    );
    expect(formatFixCategoryLabel("cian_editorial", "cian-139b-single-sentence-remove-period")).toBe(
      "Редполитика",
    );
  });

  it("показывает Редполитику для cian_editorial", () => {
    expect(formatFixCategoryLabel("cian_editorial", "cian-ty-vy")).toBe("Редполитика");
  });

  it("оставляет прочие категории как есть", () => {
    expect(formatFixCategoryLabel("typography", "cian-130")).toBe("typography");
  });

  it("показывает Выбор формы для form_choice", () => {
    expect(formatFixCategoryLabel("form_choice", "cian-choice-ishchite-ishchete")).toBe(
      "Выбор формы",
    );
  });

  it("форматирует подсказку для ищите/ищете", () => {
    const html = formatChoiceHintHtml("cian-choice-ishchite-ishchete");
    expect(html).toContain("reportHintTitle");
    expect(html).toContain("Подсказка:");
    expect(html).toContain("что делаете?");
    expect(html).toContain("ищете квартиру целую вечность");
    expect(html).toContain("что делайте?");
    expect(html).toContain("повелеваю: ищите квартиру только на Циане!");
    expect(html).toContain("reportHintSep");
  });

  it("скрывает Пропустить для ищите/ищете", () => {
    expect(isChoiceRuleWithoutSkip("cian-choice-ishchite-ishchete")).toBe(true);
    expect(isChoiceRuleWithoutSkip("other-rule")).toBe(false);
  });

  it("форматирует подсказку для все/всё", () => {
    const html = formatChoiceHintHtml(
      "cian-choice-vse-vsyo",
      "по редполитике Циана мы пишем ё там, где это требуется",
    );
    expect(html).toContain("reportHintTitle");
    expect(html).toContain("Подсказка:");
    expect(html).toContain("по редполитике Циана мы пишем ё там, где это требуется");
  });

  it("скрывает Пропустить для все/всё", () => {
    expect(isChoiceRuleWithoutSkip("cian-choice-vse-vsyo")).toBe(true);
  });

  it("форматирует заголовок слоя со счётчиком символов", () => {
    const html = formatLayerTitleHtml("1:2", "Заголовок", 142);
    expect(html).toContain('data-node-id="1:2"');
    expect(html).toContain("Заголовок");
    expect(html).toContain("reportLayerMeta");
    expect(html).toContain("142 символа");
  });

  it("форматирует блок со всеми текстовыми слоями", () => {
    const html = formatTextLayersBlockHtml(
      [
        { nodeId: "1:1", nodeName: "Заголовок", characterCount: 10 },
        { nodeId: "1:2", nodeName: "Текст", characterCount: 25 },
      ],
      false,
    );
    expect(html).toContain("Счётчик символов");
    expect(html).not.toContain("textLayersDetailsBrief");
    expect(html).not.toContain("35 символов");
    expect(html).toContain("Заголовок");
    expect(html).toContain("10 символов");
    expect(html).not.toContain('details class="textLayersDetails" open');
  });
});

describe("renderTechDetailsBodyHtml", () => {
  const baseLexiconLoad = (): LexiconLoadStatusDto => ({
    replacements: { ok: true, count: 1, fromRemote: false },
    boundaryExceptions: { ok: true, count: 1, fromRemote: false },
    formChoices: { ok: true, count: 2, fromRemote: false },
    spellDictionary: { ok: true, count: 146269, fromRemote: false },
    spellSupplement: { ok: true, count: 3, fromRemote: false },
    spellWhitelist: { ok: true, count: 4, fromRemote: false },
  });

  it("показывает form-choices при успешной подгрузке с GitHub", () => {
    const html = renderTechDetailsBodyHtml({
      ...baseLexiconLoad(),
      formChoices: { ok: true, count: 2, fromRemote: true },
    });
    expect(html).toContain("Выбор формы (form-choices) с GitHub");
    expect(html).toContain("<b>2</b> пар");
  });

  it("показывает fallback form-choices при ошибке remote", () => {
    const html = renderTechDetailsBodyHtml({
      ...baseLexiconLoad(),
      formChoices: {
        ok: false,
        count: 2,
        fromRemote: false,
        errorMessage: "HTTP 404",
      },
    });
    expect(html).toContain("Выбор формы — встроенный список");
    expect(html).toContain("HTTP 404");
  });
});
