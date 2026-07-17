import { describe, expect, it } from "vitest";
import { applyAllRules } from "../../test/helpers";
import { buildPhoneRules, formatRuPhoneToCianStandard } from "./phone-rules";

const rules = buildPhoneRules();
const nbsp = "\u00a0";
const formatted = `+7${nbsp}999${nbsp}123-45-67`;

describe("formatRuPhoneToCianStandard", () => {
  it("форматирует номер с 8", () => {
    expect(formatRuPhoneToCianStandard("89991234567")).toBe(formatted);
    expect(formatRuPhoneToCianStandard("8 (999) 123-45-67")).toBe(formatted);
  });

  it("форматирует номер с 7 без плюса", () => {
    expect(formatRuPhoneToCianStandard("79991234567")).toBe(formatted);
    expect(formatRuPhoneToCianStandard("7 999 123 45 67")).toBe(formatted);
  });

  it("оставляет +7 в полном формате", () => {
    expect(formatRuPhoneToCianStandard("+79991234567")).toBe(formatted);
  });

  it("меняет 8 на +7 даже у неполного номера", () => {
    expect(formatRuPhoneToCianStandard("8 999 123")).toBe("+7 999 123");
  });
});

describe("buildPhoneRules", () => {
  it("8 → +7 в полном формате", () => {
    expect(applyAllRules("звоните 89991234567", rules)).toBe(`звоните ${formatted}`);
  });

  it("7 без плюса → +7 в полном формате", () => {
    expect(applyAllRules("звоните 79991234567", rules)).toBe(`звоните ${formatted}`);
  });

  it("не трогает короткие числа", () => {
    expect(applyAllRules("версия 7.0", rules)).toBe("версия 7.0");
  });
});
