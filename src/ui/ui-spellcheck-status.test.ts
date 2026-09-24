import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderSpellcheckStatusHtml } from "./ui-render-sections";
import { applySpellcheckStatus, state } from "./ui-state";

describe("renderSpellcheckStatusHtml", () => {
  beforeEach(() => {
    state.spellcheckInProgress = false;
  });

  it("пусто, пока орфография не в процессе", () => {
    expect(renderSpellcheckStatusHtml()).toBe("");
  });

  it("рисует спиннер и текст «Проверяю орфорграфию — пажжите малька»", () => {
    applySpellcheckStatus(true);
    const html = renderSpellcheckStatusHtml();
    expect(html).toContain("spellcheckStatus");
    expect(html).toContain("spellcheckSpinner");
    expect(html).toContain("Проверяю орфорграфию — пажжите малька");
  });
});

describe("handlePluginMessage spellcheckStatus", () => {
  beforeEach(() => {
    state.spellcheckInProgress = false;
    vi.resetModules();
  });

  it("включает и выключает статус по сообщению плагина", async () => {
    vi.doMock("./ui-render", () => ({
      render: vi.fn(),
      renderPluginError: vi.fn(),
    }));
    vi.doMock("./ui-events", () => ({ initUiEvents: vi.fn() }));
    vi.doMock("./ui-plugin-bridge", () => ({ sendToPlugin: vi.fn() }));

    const { handlePluginMessage } = await import("./ui-messages");
    const { state: liveState } = await import("./ui-state");

    handlePluginMessage({
      data: { pluginMessage: { type: "plugin:spellcheckStatus", active: true } },
    } as MessageEvent);
    expect(liveState.spellcheckInProgress).toBe(true);

    handlePluginMessage({
      data: { pluginMessage: { type: "plugin:spellcheckStatus", active: false } },
    } as MessageEvent);
    expect(liveState.spellcheckInProgress).toBe(false);
  });
});
