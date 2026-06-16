import { describe, expect, it } from "vitest";
import {
  buildInformalYouAlternation,
  capitalizeCyrillicFirst,
  collectTySurfaceForms,
} from "./ty-vy-pronoun-forms";

describe("ty-vy-pronoun-forms", () => {
  it("collectTySurfaceForms: ё и е", () => {
    expect(collectTySurfaceForms("твоём")).toEqual(
      expect.arrayContaining(["твоём", "Твоём", "твоем", "Твоем"]),
    );
  });

  it("alternation длиннее коротких форм", () => {
    const alt = buildInformalYouAlternation();
    expect(alt.indexOf("твоего")).toBeLessThan(alt.indexOf("ты"));
  });

  it("capitalizeCyrillicFirst", () => {
    expect(capitalizeCyrillicFirst("ваш")).toBe("Ваш");
    expect(capitalizeCyrillicFirst("ваше")).toBe("Ваше");
  });
});
