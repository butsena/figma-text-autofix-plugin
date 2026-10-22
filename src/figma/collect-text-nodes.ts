function isHiddenFrame(node: BaseNode): boolean {
  return node.type === "FRAME" && node.visible === false;
}

/** Текст внутри фрейма с выключенным глазом на холсте не виден, даже если сам слой не скрыт. */
function isInsideHiddenFrame(node: BaseNode): boolean {
  let current: BaseNode | null = node;
  while (current) {
    if (isHiddenFrame(current)) return true;
    current = current.parent;
  }
  return false;
}

/** Собрать все TextNode внутри выделенных слоёв (без дублей по id). Скрытые фреймы не считаем. */
export function collectTextNodesFromSelection(selection: readonly SceneNode[]): TextNode[] {
  const all: TextNode[] = [];

  function walk(node: SceneNode) {
    if (isInsideHiddenFrame(node)) return;
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
