import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildSmsRules } from "./sms-rules";

const rules = buildSmsRules();

describe("buildSmsRules", () => {
  describe("кириллица СМС", () => {
    it("в начале предложения: СМС → Смс", () => {
      expect(applyAllRules("СМС пришло.", rules)).toBe("Смс пришло.");
    });

    it("в начале текста: СМС → Смс", () => {
      expect(applyAllRules("СМС", rules)).toBe("Смс");
    });

    it("в середине предложения: СМС → смс", () => {
      expect(applyAllRules("получите СМС сегодня", rules)).toBe("получите смс сегодня");
    });

    it("после точки снова начало предложения", () => {
      expect(applyAllRules("Готово. СМС отправлено.", rules)).toBe("Готово. Смс отправлено.");
    });
  });

  describe("латиница SMS", () => {
    it("в начале: SMS → Смс", () => {
      expect(applyAllRules("SMS пришло.", rules)).toBe("Смс пришло.");
    });

    it("в начале: sms → Смс", () => {
      expect(applyAllRules("sms пришло.", rules)).toBe("Смс пришло.");
    });

    it("в середине: SMS → смс", () => {
      expect(applyAllRules("получите SMS сегодня", rules)).toBe("получите смс сегодня");
    });

    it("в середине: sms → смс", () => {
      expect(applyAllRules("код в sms придёт", rules)).toBe("код в смс придёт");
    });

    it("после точки: Sms → Смс", () => {
      expect(applyAllRules("Готово. Sms отправлено.", rules)).toBe("Готово. Смс отправлено.");
    });
  });

  describe("уже правильные формы", () => {
    it("не трогает смс в середине", () => {
      expect(fixesFor("получите смс", rules)).toHaveLength(0);
    });

    it("не трогает Смс в начале", () => {
      expect(fixesFor("Смс пришло.", rules)).toHaveLength(0);
    });

    it("исправляет смс в начале предложения на Смс", () => {
      expect(applyAllRules("смс пришло.", rules)).toBe("Смс пришло.");
    });
  });

  describe("диапазон замены", () => {
    it("меняет только слово, без пробела перед ним (стиль пробела сохраняется)", () => {
      const [fix] = fixesFor("в SMS", rules);
      expect(fix).toMatchObject({ before: "SMS", after: "смс", from: 2, to: 5 });
    });
  });
});
