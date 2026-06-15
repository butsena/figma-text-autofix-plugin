export async function focusLayerById(nodeId: string): Promise<void> {
  const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;
  if (!node) return;

  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}
