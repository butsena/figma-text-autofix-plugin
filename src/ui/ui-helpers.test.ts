import { describe, expect, it } from "vitest";
import { formatFixCategoryLabel } from "./ui-helpers";

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
});
