import { describe, expect, it } from "vitest";
import {
  countConfirmFixes,
  detailsOpenAttr,
  displayText,
  formatChoiceHintHtml,
  formatFixCategoryLabel,
  formatLayerTitleHtml,
  formatTextLayersBlockHtml,
  layerRowLabel,
} from "./ui-helpers";

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

  it("форматирует подсказку для пишите/пишете", () => {
    const html = formatChoiceHintHtml("cian-choice-pishite-pishete");
    expect(html).toContain("что делайте?");
    expect(html).toContain("пишите письма мелким почерком");
    expect(html).toContain("что делаете?");
    expect(html).toContain("вы всегда пишете правильно");
  });

  it("форматирует подсказку для будите/будете", () => {
    const html = formatChoiceHintHtml("cian-choice-budite-budete");
    expect(html).toContain("что делайте?");
    expect(html).toContain("не будите спящего");
    expect(html).toContain("форма «быть»");
    expect(html).toContain("вы будете дома вечером");
    expect(html).toContain("Подсказка:");
  });

  it("форматирует подсказку для напишите/напишете", () => {
    const html = formatChoiceHintHtml("cian-choice-napishite-napishete");
    expect(html).toContain("что сделайте?");
    expect(html).toContain("напишите мне срочно!");
    expect(html).toContain("что сделаете?");
    expect(html).toContain("завтра вы все напишете диктант!");
  });

  it("предпочитает hintHtml с плагина (remote-пары без UI-стора)", () => {
    const html = formatChoiceHintHtml("cian-choice-unknown", undefined, "<div class=\"reportHint\">из DTO</div>");
    expect(html).toBe("<div class=\"reportHint\">из DTO</div>");
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
  it("форматирует заголовок слоя со счётчиком символов", () => {
    const html = formatLayerTitleHtml("1:2", "Заголовок", 142);
    expect(html).toContain('data-node-id="1:2"');
    expect(html).toContain("Заголовок");
    expect(html).toContain("reportLayerMeta");
    expect(html).toContain("142 символа");
  });

  it("форматирует блок со всеми текстовыми слоями", () => {
    const longText = "Квартира свободна уже завтра утром";
    const html = formatTextLayersBlockHtml([
      { nodeId: "1:1", nodeName: "Заголовок", characterCount: 10, text: "Заголовок" },
      {
        nodeId: "1:2",
        nodeName: "Текст",
        characterCount: longText.length,
        text: longText,
        frameName: "Карточка объявления",
      },
    ]);
    expect(html).toContain("textLayersTable");
    expect(html).not.toContain("Счётчик символов");
    expect(html).not.toContain("textLayersDetails");
    expect(html).toContain("Заголовок");
    expect(html).toContain("10 символов");
    expect(html).toContain("Карточка объявления");
    expect(html).not.toContain(longText);
    expect(layerRowLabel("напишите мне", "Фрейм")).toBe("напишите мне");
    expect(layerRowLabel("а".repeat(25), "Фрейм")).toBe("а".repeat(25));
    expect(layerRowLabel("а".repeat(26), "Фрейм")).toBe("Фрейм");
  });
});

describe("displayText", () => {
  it("строка / message / JSON / fallback", () => {
    expect(displayText(null)).toBe("");
    expect(displayText("ok")).toBe("ok");
    expect(displayText({ message: "err" })).toBe("err");
    expect(displayText({ a: 1 })).toBe('{"a":1}');
  });
});

describe("countConfirmFixes", () => {
  it("суммирует fixes по карточкам", () => {
    expect(countConfirmFixes([{ fixes: [1, 2] }, { fixes: [3] }, {}])).toBe(3);
  });
});

describe("detailsOpenAttr", () => {
  it("open только при true", () => {
    expect(detailsOpenAttr(true)).toBe(" open");
    expect(detailsOpenAttr(false)).toBe("");
  });
});
