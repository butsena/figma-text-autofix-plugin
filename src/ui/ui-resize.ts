import {
  PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MIN_HEIGHT,
  PLUGIN_UI_WIDTH,
} from "../shared/plugin-ui-layout";
import { sendToPlugin } from "./ui-plugin-bridge";
import { restoreScrollTop, restoreScrollTopSoon } from "./ui-scroll";

function maxPluginHeight(): number {
  const avail =
    typeof window !== "undefined" && window.screen && window.screen.availHeight
      ? window.screen.availHeight - 64
      : PLUGIN_UI_MAX_HEIGHT;
  return Math.min(avail, PLUGIN_UI_MAX_HEIGHT);
}

/** Высота содержимого, а не текущего окна. Иначе короткий iframe сам себя и измеряет. */
function computePluginContentHeight(): number {
  const main = document.querySelector(".appMain");
  const shell = document.querySelector(".appShell");
  if (
    typeof HTMLElement !== "undefined" &&
    main instanceof HTMLElement &&
    shell instanceof HTMLElement
  ) {
    let extra = 0;
    for (const child of shell.children) {
      if (child === main || !(child instanceof HTMLElement)) continue;
      extra += child.offsetHeight;
    }
    const bodyStyle = document.body ? getComputedStyle(document.body) : null;
    const pad = bodyStyle
      ? (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0)
      : 0;
    return Math.ceil(main.offsetHeight + extra + pad);
  }
  return Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
}

function applyPluginScrollMode(contentHeight: number): void {
  const capped = contentHeight > maxPluginHeight();
  const overflow = capped ? "auto" : "";
  document.documentElement.style.overflowY = overflow;
  document.body.style.overflowY = overflow;
}

function publishResize(): void {
  const contentHeight = computePluginContentHeight();
  if (contentHeight <= 0) return;
  const targetHeight = Math.max(
    PLUGIN_UI_MIN_HEIGHT,
    Math.min(maxPluginHeight(), contentHeight),
  );
  applyPluginScrollMode(contentHeight);
  sendToPlugin({
    type: "ui:resize",
    width: PLUGIN_UI_WIDTH,
    height: targetHeight,
  });
  restoreScrollTop();
  restoreScrollTopSoon();
}

let pluginResizeFrame = 0;

export function schedulePluginResize(): void {
  // Сразу: requestAnimationFrame в iframe Figma иногда приходит через секунды,
  // и отчёт успевает показаться в коротком окне.
  publishResize();
  if (typeof requestAnimationFrame === "function") {
    if (pluginResizeFrame) cancelAnimationFrame(pluginResizeFrame);
    pluginResizeFrame = requestAnimationFrame(function () {
      pluginResizeFrame = 0;
      publishResize();
    });
  }
}
