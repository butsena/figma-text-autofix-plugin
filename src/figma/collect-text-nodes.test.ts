import { describe, expect, it } from "vitest";
import { collectTextNodesFromSelection } from "./collect-text-nodes";

function textNode(id: string, name = id): TextNode {
  return { id, name, type: "TEXT", characters: "x", parent: null } as unknown as TextNode;
}

function frame(id: string, children: SceneNode[], visible = true): SceneNode {
  const node = { id, type: "FRAME", children, visible, parent: null } as unknown as SceneNode;
  for (const child of children) {
    (child as unknown as { parent: SceneNode }).parent = node;
  }
  return node;
}

describe("collectTextNodesFromSelection", () => {
  it("собирает TextNode из вложенных фреймов", () => {
    const a = textNode("a");
    const b = textNode("b");
    const nodes = collectTextNodesFromSelection([frame("f1", [a, frame("f2", [b])])]);
    expect(nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("убирает дубли по id", () => {
    const a = textNode("a");
    const nodes = collectTextNodesFromSelection([a, frame("f", [a])]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("a");
  });

  it("не считает текст внутри скрытого фрейма", () => {
    const visibleText = textNode("vis", "Покупайте наших псов");
    const hiddenText = textNode("hid", "12%");
    const nested = textNode("nested", "1");
    const hidden = frame("hidden", [hiddenText, frame("inner", [nested])], false);
    const root = frame("root", [visibleText, hidden]);

    expect(collectTextNodesFromSelection([root]).map((n) => n.id)).toEqual(["vis"]);
    expect(collectTextNodesFromSelection([hiddenText, nested])).toEqual([]);
  });

  it("игнорирует узлы без текста и без children", () => {
    const rect = { id: "r", type: "RECTANGLE" } as unknown as SceneNode;
    expect(collectTextNodesFromSelection([rect])).toEqual([]);
  });
});
