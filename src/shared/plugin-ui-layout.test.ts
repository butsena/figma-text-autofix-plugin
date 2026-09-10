import { describe, expect, it } from "vitest";
import {
  PLUGIN_UI_INITIAL_HEIGHT,
  PLUGIN_UI_MAX_HEIGHT,
  PLUGIN_UI_MIN_HEIGHT,
  PLUGIN_UI_WIDTH,
  clampPluginUiHeight,
} from "./plugin-ui-layout";

describe("plugin-ui-layout", () => {
  it("имеет разумные константы окна", () => {
    expect(PLUGIN_UI_WIDTH).toBe(390);
    expect(PLUGIN_UI_MIN_HEIGHT).toBeLessThan(PLUGIN_UI_INITIAL_HEIGHT);
    expect(PLUGIN_UI_INITIAL_HEIGHT).toBeLessThan(PLUGIN_UI_MAX_HEIGHT);
  });

  it("clampPluginUiHeight ограничивает и округляет", () => {
    expect(clampPluginUiHeight(10)).toBe(PLUGIN_UI_MIN_HEIGHT);
    expect(clampPluginUiHeight(9999)).toBe(PLUGIN_UI_MAX_HEIGHT);
    expect(clampPluginUiHeight(300.6)).toBe(301);
  });
});
