import { describe, expect, it } from "vitest";
import { headerColIndex, isEnabledCell, parseCsvLine, parseCsvRows } from "./csv";

describe("parseCsvLine", () => {
  it("разбивает простую строку", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("учитывает кавычки и экранирование", () => {
    expect(parseCsvLine('"foo, bar","baz""qux"')).toEqual(["foo, bar", 'baz"qux']);
  });

  it("сохраняет пробелы внутри кавычек", () => {
    expect(parseCsvLine('" spaced ",plain')).toEqual([" spaced ", "plain"]);
  });
});

describe("parseCsvRows", () => {
  it("пропускает пустые строки и комментарии", () => {
    const raw = `# header
a,b

c,d`;
    expect(parseCsvRows(raw)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("поддерживает CRLF", () => {
    expect(parseCsvRows("x,y\r\nz,w")).toEqual([
      ["x", "y"],
      ["z", "w"],
    ]);
  });
});

describe("headerColIndex", () => {
  it("находит колонку по алиасу без учёта регистра", () => {
    const header = ["Variants", "Replace", "Enabled"];
    expect(headerColIndex(header, ["replace"])).toBe(1);
    expect(headerColIndex(header, ["VARIANTS", "source"])).toBe(0);
  });

  it("возвращает -1, если колонка не найдена", () => {
    expect(headerColIndex(["a", "b"], ["missing"])).toBe(-1);
  });

  it("нормализует пробелы в заголовках", () => {
    expect(headerColIndex(["исходные  варианты"], ["исходные варианты"])).toBe(0);
  });
});

describe("isEnabledCell", () => {
  it("распознаёт включённые значения", () => {
    expect(isEnabledCell("yes")).toBe(true);
    expect(isEnabledCell("TRUE")).toBe(true);
    expect(isEnabledCell("1")).toBe(true);
    expect(isEnabledCell(" да ")).toBe(true);
  });

  it("отклоняет выключенные значения", () => {
    expect(isEnabledCell("no")).toBe(false);
    expect(isEnabledCell("false")).toBe(false);
    expect(isEnabledCell("")).toBe(false);
  });
});
