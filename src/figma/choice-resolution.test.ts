import { describe, expect, it } from "vitest";
import {
  applySkipToResolutions,
  createChoiceResolution,
  findResolutionPositions,
  pruneStaleResolutions,
  readChoiceResolutionsFromPluginData,
  shouldSuppressChoiceFix,
  stripInvalidatedResolutionsForFixes,
  upsertChoiceResolution,
} from "./choice-resolution";

const RULE_ID = "cian-choice-ishchite-ishchete";
const SPELL_RULE_ID = "orthography-spellcheck";

describe("choice-resolution", () => {
  const text = "скорее ищите квартиру";
  const from = text.indexOf("ищите");
  const to = from + "ищите".length;

  it("подавляет повторный показ после подтверждения ищите", () => {
    const resolution = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    expect(
      shouldSuppressChoiceFix(
        text,
        { ruleId: RULE_ID, from, to, before: "ищите" },
        [resolution],
      ),
    ).toBe(true);
  });

  it("снова показывает, если слово на месте изменили вручную", () => {
    const resolution = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    const edited = "скорее ищете квартиру";
    const editedFrom = edited.indexOf("ищете");
    expect(
      shouldSuppressChoiceFix(
        edited,
        {
          ruleId: RULE_ID,
          from: editedFrom,
          to: editedFrom + "ищете".length,
          before: "ищете",
        },
        [resolution],
      ),
    ).toBe(false);
  });

  it("снова показывает после сценария ищете → подтвердили ищите → вручную ищете", () => {
    const afterConfirm = "скорее ищите квартиру";
    const confirmFrom = afterConfirm.indexOf("ищите");
    const resolution = createChoiceResolution(
      afterConfirm,
      RULE_ID,
      confirmFrom,
      confirmFrom + "ищите".length,
      "ищете",
      "ищите",
    );

    const afterManual = "скорее ищете квартиру";
    const fixFrom = afterManual.indexOf("ищете");
    const fix = {
      ruleId: RULE_ID,
      from: fixFrom,
      to: fixFrom + "ищете".length,
      before: "ищете",
    };

    const stripped = stripInvalidatedResolutionsForFixes(afterManual, [fix], [resolution]);
    expect(stripped).toHaveLength(0);
    expect(shouldSuppressChoiceFix(afterManual, fix, stripped)).toBe(false);
  });

  it("подавляет после смены ищете → ищите", () => {
    const updated = "скорее ищите квартиру";
    const updatedFrom = updated.indexOf("ищите");
    const resolution = createChoiceResolution(
      updated,
      RULE_ID,
      updatedFrom,
      updatedFrom + "ищите".length,
      "ищете",
      "ищите",
    );
    expect(
      shouldSuppressChoiceFix(
        updated,
        {
          ruleId: RULE_ID,
          from: updatedFrom,
          to: updatedFrom + "ищите".length,
          before: "ищите",
        },
        [resolution],
      ),
    ).toBe(true);
  });

  it("находит позицию по якорям после сдвига индексов", () => {
    const shifted = "Уже скорее ищите квартиру";
    const resolution = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    const positions = findResolutionPositions(shifted, resolution);
    const wordFrom = shifted.indexOf("ищите");
    expect(positions).toContainEqual({ from: wordFrom, to: wordFrom + "ищите".length });
  });

  it("находит слот по якорям, даже если форму слова поменяли", () => {
    const resolution = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    const edited = "скорее ищете квартиру";
    const positions = findResolutionPositions(edited, resolution);
    const fixFrom = edited.indexOf("ищете");
    expect(positions).toContainEqual({ from: fixFrom, to: fixFrom + "ищете".length });
    expect(edited.slice(fixFrom, fixFrom + "ищете".length)).toBe("ищете");
  });

  it("удаляет устаревшие записи, если якорный слот исчез", () => {
    const resolution = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    const pruned = pruneStaleResolutions("совсем другой текст", [resolution]);
    expect(pruned).toHaveLength(0);
  });

  it("переякоривает resolution после автоправки NBSP вокруг слова", () => {
    const resolution = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    const afterNbsp = "скорее\u00a0ищите квартиру";
    const pruned = pruneStaleResolutions(afterNbsp, [resolution]);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]?.chosen).toBe("ищите");
    expect(
      shouldSuppressChoiceFix(
        afterNbsp,
        {
          ruleId: RULE_ID,
          from: afterNbsp.indexOf("ищите"),
          to: afterNbsp.indexOf("ищите") + "ищите".length,
          before: "ищите",
        },
        pruned,
      ),
    ).toBe(true);
  });

  it("переякоривает все/всё после NBSP", () => {
    const src = "проверьте все варианты";
    const wordFrom = src.indexOf("все");
    const resolution = createChoiceResolution(
      src,
      "cian-choice-vse-vsyo",
      wordFrom,
      wordFrom + "все".length,
      "все",
      "все",
    );
    const afterNbsp = "проверьте\u00a0все варианты";
    const pruned = pruneStaleResolutions(afterNbsp, [resolution]);
    expect(pruned).toHaveLength(1);
    expect(
      shouldSuppressChoiceFix(
        afterNbsp,
        {
          ruleId: "cian-choice-vse-vsyo",
          from: afterNbsp.indexOf("все"),
          to: afterNbsp.indexOf("все") + "все".length,
          before: "все",
        },
        pruned,
      ),
    ).toBe(true);
  });

  it("обновляет запись для того же слота", () => {
    const first = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    const second = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищете");
    const merged = upsertChoiceResolution([first], second);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.chosen).toBe("ищете");
  });

  it("readChoiceResolutionsFromPluginData фильтрует битый JSON", () => {
    expect(readChoiceResolutionsFromPluginData("")).toEqual([]);
    expect(readChoiceResolutionsFromPluginData("{")).toEqual([]);
    expect(readChoiceResolutionsFromPluginData("[]")).toEqual([]);
    const valid = createChoiceResolution(text, RULE_ID, from, to, "ищите", "ищите");
    expect(readChoiceResolutionsFromPluginData(JSON.stringify([valid, { ruleId: 1 }])))
      .toHaveLength(1);
  });
});

describe("spell skip resolution", () => {
  const text = "Кватира в центре";
  const from = text.indexOf("Кватира");
  const to = from + "Кватира".length;
  const fix = {
    ruleId: SPELL_RULE_ID,
    from,
    to,
    before: "Кватира",
  };

  it("один skip прячет карточку и в этом запуске, и в следующем", () => {
    const resolutions = applySkipToResolutions(text, fix, []);
    expect(resolutions[0]?.skipCount).toBe(1);
    expect(resolutions[0]?.chosen).toBe("Кватира");
    expect(shouldSuppressChoiceFix(text, fix, resolutions)).toBe(true);

    const same = applySkipToResolutions(text, fix, resolutions);
    expect(same[0]?.skipCount).toBe(1);
    expect(shouldSuppressChoiceFix(text, fix, same)).toBe(true);
  });

  it("старый незавершённый счётчик тоже больше не показывает", () => {
    const legacy = createChoiceResolution(text, SPELL_RULE_ID, from, to, "Кватира", "", 1);
    expect(shouldSuppressChoiceFix(text, fix, [legacy])).toBe(true);

    const same = applySkipToResolutions(text, fix, [legacy]);
    expect(same[0]?.skipCount).toBe(1);
    expect(same[0]?.chosen).toBe("");
  });

  it("после исправления не показывает повторно", () => {
    const fixed = "Квартира в центре";
    const fixedFrom = fixed.indexOf("Квартира");
    const resolution = createChoiceResolution(
      fixed,
      SPELL_RULE_ID,
      fixedFrom,
      fixedFrom + "Квартира".length,
      "Кватира",
      "Квартира",
    );
    expect(
      shouldSuppressChoiceFix(
        fixed,
        {
          ruleId: SPELL_RULE_ID,
          from: fixedFrom,
          to: fixedFrom + "Квартира".length,
          before: "Квартира",
        },
        [resolution],
      ),
    ).toBe(true);
  });
});
