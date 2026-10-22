/** Прокрутка окна плагина. innerHTML в render() сбрасывает её наверх. */

let heldScrollTop = 0;
let heldGeneration = 0;

function readWindowScrollTop(): number {
  const scrolling = document.scrollingElement;
  if (scrolling && typeof scrolling.scrollTop === "number") return scrolling.scrollTop;
  const root = document.documentElement;
  if (root && typeof root.scrollTop === "number") return root.scrollTop;
  const body = document.body;
  if (body && typeof body.scrollTop === "number") return body.scrollTop;
  return 0;
}

function writeWindowScrollTop(top: number): void {
  if (!(top > 0)) return;
  const scrolling = document.scrollingElement;
  if (scrolling) scrolling.scrollTop = top;
  const root = document.documentElement;
  if (root) root.scrollTop = top;
  const body = document.body;
  if (body) body.scrollTop = top;
}

export function captureScrollTop(): void {
  heldGeneration += 1;
  heldScrollTop = readWindowScrollTop();
}

export function restoreScrollTop(): void {
  writeWindowScrollTop(heldScrollTop);
}

/** Повтор после resize окна Figma: он приходит позже и снова поднимает отчёт наверх. */
export function restoreScrollTopSoon(): void {
  const generation = heldGeneration;
  const top = heldScrollTop;
  const apply = (): void => {
    if (generation !== heldGeneration) return;
    writeWindowScrollTop(top);
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(apply);
  }
  setTimeout(apply, 80);
}
