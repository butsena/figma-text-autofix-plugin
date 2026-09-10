export const PLUGIN_UI_WIDTH = 390;
export const PLUGIN_UI_MIN_HEIGHT = 220;
export const PLUGIN_UI_MAX_HEIGHT = 750;
export const PLUGIN_UI_INITIAL_HEIGHT = 260;

/** Высота UI плагина в допустимых пределах. */
export function clampPluginUiHeight(height: number): number {
  return Math.max(PLUGIN_UI_MIN_HEIGHT, Math.min(PLUGIN_UI_MAX_HEIGHT, Math.round(height)));
}
