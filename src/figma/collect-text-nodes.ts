/** Собрать все TextNode внутри выделенных слоёв (без дублей по id). */
export function collectTextNodesFromSelection(selection: readonly SceneNode[]): TextNode[] {
  const all: TextNode[] = [];

  function walk(node: SceneNode) {
    if (node.type === "TEXT") {
      all.push(node);
      return;
    }
    // @ts-expect-error — у контейнеров в рантайме есть children
    const children: readonly SceneNode[] | undefined = node.children;
    if (!children) return;
    for (const child of children) walk(child);
  }

  for (const node of selection) walk(node);

  const byId = new Map<string, TextNode>();
  for (const t of all) byId.set(t.id, t);
  return [...byId.values()];
}
