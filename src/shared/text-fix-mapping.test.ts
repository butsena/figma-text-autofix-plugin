import { describe, expect, it } from "vitest";
import type { TextFixDto } from "./messages";
import { textFixDtoToEngineFix } from "./text-fix-mapping";

describe("textFixDtoToEngineFix", () => {
  const dto: TextFixDto = {
    fixId: "node:rule:0:3",
    from: 0,
    to: 3,
    before: "foo",
    after: "bar",
    rule: {
      id: "test-rule",
      category: "typography",
      message: "тестовое сообщение",
      hint: "подсказка",
      choiceOptions: ["вариант1", "вариант2"],
      priority: 42,
      applyPolicy: "confirm",
    },
  };

  it("переносит поля правки и метаданные правила", () => {
    expect(textFixDtoToEngineFix(dto)).toEqual({
      from: 0,
      to: 3,
      before: "foo",
      after: "bar",
      ruleId: "test-rule",
      category: "typography",
      message: "тестовое сообщение",
      hint: "подсказка",
      choiceOptions: ["вариант1", "вариант2"],
      priority: 42,
      applyPolicy: "confirm",
    });
  });

  it("не добавляет hint и choiceOptions, если их нет", () => {
    const minimal = textFixDtoToEngineFix({
      ...dto,
      rule: {
        id: "minimal",
        category: "test",
        message: "msg",
        priority: 1,
        applyPolicy: "auto",
      },
    });
    expect(minimal).not.toHaveProperty("hint");
    expect(minimal).not.toHaveProperty("choiceOptions");
    expect(minimal.applyPolicy).toBe("auto");
  });

  it("прокидывает hintHtml", () => {
    const withHtml = textFixDtoToEngineFix({
      ...dto,
      rule: {
        ...dto.rule,
        hintHtml: "<div class=\"reportHint\">hint</div>",
      },
    });
    expect(withHtml.hintHtml).toBe("<div class=\"reportHint\">hint</div>");
  });
});
