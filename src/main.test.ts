import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_TEXT_IN_SELECTION_NOTICE } from "./shared/messages";

const notify = vi.fn();
const closePlugin = vi.fn();
const showUI = vi.fn();

vi.mock("./ui/ui.figma.html?raw", () => ({ default: "<html></html>" }));
vi.mock("./figma/autofix-pipeline", () => ({ runAutofixPipeline: vi.fn() }));
vi.mock("./figma/apply-manual-fix", () => ({
  applyManualFixAndRefresh: vi.fn(),
  skipManualFixAndRefresh: vi.fn(),
}));
vi.mock("./figma/focus-layer", () => ({ focusLayerById: vi.fn() }));
vi.mock("./figma/choice-resolution", () => ({ beginPluginRun: vi.fn() }));
vi.mock("./analytics/track", () => ({
  beginAnalyticsSession: vi.fn(() => "sess_test12345678"),
}));
vi.mock("./analytics/pipeline-events", () => ({
  trackPluginOpen: vi.fn(),
  trackPluginError: vi.fn(),
}));

function installFigma(selection: unknown[]): void {
  vi.stubGlobal("figma", {
    currentPage: { selection },
    notify,
    closePlugin,
    showUI,
    ui: {
      postMessage: vi.fn(),
      resize: vi.fn(),
      onmessage: null,
    },
  });
}

async function boot(): Promise<void> {
  vi.resetModules();
  await import("./main");
}

describe("пустой запуск", () => {
  beforeEach(() => {
    notify.mockClear();
    closePlugin.mockClear();
    showUI.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("без текстовых слоёв показывает красный тост и закрывается не сразу", async () => {
    installFigma([]);
    await boot();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(NO_TEXT_IN_SELECTION_NOTICE, { error: true });
    expect(showUI).not.toHaveBeenCalled();
    expect(closePlugin).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2499);
    expect(closePlugin).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(closePlugin).toHaveBeenCalledTimes(1);
    expect(closePlugin).toHaveBeenCalledWith();
  });

  it("со слоем текста тоста нет и панель открывается", async () => {
    installFigma([{ id: "1:1", type: "TEXT", name: "Слой", characters: "напишите мне" }]);
    await boot();

    expect(notify).not.toHaveBeenCalled();
    expect(closePlugin).not.toHaveBeenCalled();
    expect(showUI).toHaveBeenCalledTimes(1);
  });
});
