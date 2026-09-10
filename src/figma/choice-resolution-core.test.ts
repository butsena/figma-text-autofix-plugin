import { describe, expect, it } from "vitest";
import {
  buildChoiceAnchors,
  findChosenWordNear,
  isChoiceResolution,
  pruneStaleResolutions,
  readChoiceResolutionsFromPluginData,
  type ChoiceResolution,
} from "./choice-resolution-core";

describe("isChoiceResolution", () => {
  it("отклоняет битые и частичные объекты", () => {
    expect(isChoiceResolution(null)).toBe(false);
    expect(isChoiceResolution({})).toBe(false);
    expect(
      isChoiceResolution({
        ruleId: "r",
        chosen: "a",
        beforeAtResolve: "b",
        anchorBefore: "",
        anchorAfter: "",
        wordLength: "x",
      }),
    ).toBe(false);
    expect(
      isChoiceResolution({
        ruleId: "r",
        chosen: "a",
        beforeAtResolve: "b",
        anchorBefore: "",
        anchorAfter: "",
        wordLength: 1,
        skipCount: -1,
      }),
    ).toBe(false);
  });

  it("принимает валидную запись", () => {
    expect(
      isChoiceResolution({
        ruleId: "r",
        chosen: "ищите",
        beforeAtResolve: "ищете",
        anchorBefore: " ",
        anchorAfter: " ",
        wordLength: 6,
        skipCount: 1,
      }),
    ).toBe(true);
  });
});

describe("readChoiceResolutionsFromPluginData", () => {
  it("пустой / невалидный JSON → []", () => {
    expect(readChoiceResolutionsFromPluginData("")).toEqual([]);
    expect(readChoiceResolutionsFromPluginData("{")).toEqual([]);
    expect(readChoiceResolutionsFromPluginData("{}")).toEqual([]);
    expect(readChoiceResolutionsFromPluginData("null")).toEqual([]);
  });

  it("фильтрует плохие элементы массива", () => {
    const valid: ChoiceResolution = {
      ruleId: "r",
      chosen: "a",
      beforeAtResolve: "b",
      anchorBefore: "",
      anchorAfter: "",
      wordLength: 1,
    };
    expect(readChoiceResolutionsFromPluginData(JSON.stringify([valid, { ruleId: 1 }, null]))).toEqual([
      valid,
    ]);
  });
});

describe("buildChoiceAnchors", () => {
  it("учитывает начало и конец строки", () => {
    expect(buildChoiceAnchors("ищите", 0, 5, 2)).toEqual({
      anchorBefore: "",
      anchorAfter: "",
      wordLength: 5,
    });
    expect(buildChoiceAnchors("xx ищите yy", 3, 8, 2)).toEqual({
      anchorBefore: "x ",
      anchorAfter: " y",
      wordLength: 5,
    });
  });
});

describe("findChosenWordNear", () => {
  it("находит вхождение в радиусе поиска", () => {
    const text = "ищите xxx ищите";
    expect(findChosenWordNear(text, "ищите", 0, 5)).toBe(0);
    expect(findChosenWordNear(text, "ищите", 10, 5)).toBe(10);
  });

  it("null вне радиуса", () => {
    expect(findChosenWordNear("ищите далеко", "ищите", 100, 10)).toBeNull();
  });
});

describe("pruneStaleResolutions skip-in-progress", () => {
  it("переякоривает skip, когда слово сдвинулось", () => {
    const resolution: ChoiceResolution = {
      ruleId: "orthography-spellcheck",
      chosen: "",
      beforeAtResolve: "ашыбка",
      anchorBefore: "Это ",
      anchorAfter: " текста",
      wordLength: 6,
      skipCount: 1,
    };
    const next = pruneStaleResolutions("Это ашыбка текста", [resolution]);
    expect(next).toHaveLength(1);
    expect(next[0]?.beforeAtResolve).toBe("ашыбка");

    const shifted = pruneStaleResolutions("Это\u00a0ашыбка текста", [resolution]);
    expect(shifted).toHaveLength(1);
    expect(shifted[0]?.skipCount).toBe(1);
    expect(shifted[0]?.beforeAtResolve).toBe("ашыбка");
  });

  it("удаляет skip, если слово исчезло", () => {
    const resolution: ChoiceResolution = {
      ruleId: "orthography-spellcheck",
      chosen: "",
      beforeAtResolve: "ашыбка",
      anchorBefore: "Это ",
      anchorAfter: " текста",
      wordLength: 6,
      skipCount: 1,
    };
    expect(pruneStaleResolutions("Это слово текста", [resolution])).toEqual([]);
  });
});
