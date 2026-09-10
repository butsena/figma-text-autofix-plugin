import { describe, expect, it } from "vitest";
import { collectTextNodesFromSelection } from "./collect-text-nodes";

function textNode(id: string, name = id): TextNode {
  return { id, name, type: "TEXT", characters: "x" } as unknown as TextNode;
}

function frame(id: string, children: SceneNode[]): SceneNode {
  return { id, type: "FRAME", children } as unknown as SceneNode;
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

  it("игнорирует узлы без текста и без children", () => {
    const rect = { id: "r", type: "RECTANGLE" } as unknown as SceneNode;
    expect(collectTextNodesFromSelection([rect])).toEqual([]);
  });
});
