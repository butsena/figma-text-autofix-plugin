import { describe, expect, it } from "vitest";
import { applyAllRules, fixesFor } from "../../test/helpers";
import { buildEmailRules } from "./email-rules";

const rules = buildEmailRules();

describe("buildEmailRules", () => {
  it("E-mail → Email", () => {
    expect(applyAllRules("Напишите на E-mail", rules)).toBe("Напишите на Email");
  });

  it("e-mail → email", () => {
    expect(applyAllRules("ваш e-mail подтверждён", rules)).toBe("ваш email подтверждён");
  });

  it("не трогает уже правильный Email", () => {
    expect(fixesFor("Email поддержки", rules)).toHaveLength(0);
  });
});
