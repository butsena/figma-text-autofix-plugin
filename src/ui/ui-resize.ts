import {
  PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MIN_HEIGHT,
  PLUGIN_UI_WIDTH,
} from "../shared/plugin-ui-layout";
import { sendToPlugin } from "./ui-plugin-bridge";
import { restoreScrollTop, restoreScrollTopSoon } from "./ui-scroll";

const PLUGIN_UI_MAX_HEIGHT_CAPPED = Math.min(
  window.screen && window.screen.availHeight ? window.screen.availHeight - 64 : PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MAX_HEIGHT,
);

function computePluginContentHeight(): number {
  return Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
}

function applyPluginScrollMode(contentHeight: number): void {
  const capped = contentHeight > PLUGIN_UI_MAX_HEIGHT_CAPPED;
  const overflow = capped ? "auto" : "";
  document.documentElement.style.overflowY = overflow;
  document.body.style.overflowY = overflow;
}

let pluginResizeFrame = 0;

export function schedulePluginResize(): void {
  if (pluginResizeFrame) {
    cancelAnimationFrame(pluginResizeFrame);
  }
  pluginResizeFrame = requestAnimationFrame(function () {
    pluginResizeFrame = requestAnimationFrame(function () {
      pluginResizeFrame = 0;
      const contentHeight = computePluginContentHeight();
      const targetHeight = Math.max(
        PLUGIN_UI_MIN_HEIGHT,
        Math.min(PLUGIN_UI_MAX_HEIGHT_CAPPED, contentHeight),
      );
      applyPluginScrollMode(contentHeight);
      sendToPlugin({
        type: "ui:resize",
        width: PLUGIN_UI_WIDTH,
        height: targetHeight,
      });
      restoreScrollTop();
      restoreScrollTopSoon();
    });
  });
}
