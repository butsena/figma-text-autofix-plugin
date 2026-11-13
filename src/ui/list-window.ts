/** Сколько строк отчёта рисуем за раз, пока пользователь не нажмёт «Показать ещё». */
export const FIX_ROW_PAGE = 30;

/** Сколько похожих карточек confirm или choice рисуем за раз. */
export const FIX_CARD_PAGE = 10;

export function takeLayersByFixLimit<T extends { fixes: unknown[] }>(
  layers: T[],
  limit: number,
): { layers: T[]; shown: number; total: number } {
  let total = 0;
  for (const layer of layers) total += layer.fixes.length;

  const out: T[] = [];
  let shown = 0;
  for (const layer of layers) {
    if (shown >= limit) break;
    const room = limit - shown;
    if (layer.fixes.length <= room) {
      out.push(layer);
      shown += layer.fixes.length;
      continue;
    }
    out.push({ ...layer, fixes: layer.fixes.slice(0, room) });
    shown += room;
  }
  return { layers: out, shown, total };
}
