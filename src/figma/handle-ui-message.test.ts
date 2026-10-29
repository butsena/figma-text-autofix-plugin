import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextFixDto, UiToPluginMessage } from "../shared/messages";
import { trackPluginError } from "../analytics/pipeline-events";
import { applyManualFixAndRefresh, skipManualFixAndRefresh } from "./apply-manual-fix";
import { handleUiMessage } from "./handle-ui-message";
import { annotateFailure } from "../analytics/failure";

vi.mock("../analytics/pipeline-events", () => ({ trackPluginError: vi.fn(), trackSpellcheckRequested: vi.fn() }));
vi.mock("../config/spellcheck-preference", () => ({ enableSpellcheckForSession: vi.fn() }));
vi.mock("./apply-manual-fix", () => ({ applyManualFixAndRefresh: vi.fn(), skipManualFixAndRefresh: vi.fn() }));
vi.mock("./autofix-pipeline", () => ({ runAutofixPipeline: vi.fn() }));
vi.mock("./focus-layer", () => ({ focusLayerById: vi.fn() }));

const fix: TextFixDto = {
  fixId: "spell-1", from: 0, to: 7, before: "Кватира", after: "Квартира",
  rule: { id: "orthography-spellcheck", category: "orthography", message: "m", priority: 1, applyPolicy: "confirm" },
};
const gate = () => ({ uiReady: true, runPipelineWhenReady: false });

describe("передача источника орфографии из UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["suggested", "custom", "unknown", undefined] as const)("передаёт transient enum %j в ручное применение", async (spellingSource) => {
    await handleUiMessage({ type: "ui:applyManualFix", nodeId: "1:2", fix, spellingSource }, gate());
    expect(applyManualFixAndRefresh).toHaveBeenCalledExactlyOnceWith("1:2", fix, spellingSource);
    expect(trackPluginError).not.toHaveBeenCalled();
  });

  it("skip не получает лишние метаданные из сообщения", async () => {
    const message = { type: "ui:skipManualFix", nodeId: "1:2", fix, spellingSource: "custom" } as UiToPluginMessage;
    await handleUiMessage(message, gate());
    expect(skipManualFixAndRefresh).toHaveBeenCalledExactlyOnceWith("1:2", fix);
    expect(applyManualFixAndRefresh).not.toHaveBeenCalled();
  });

  it("ошибка применения остаётся ошибкой и не скрывается метаданными", async () => {
    const error = new Error("apply failed");
    vi.mocked(applyManualFixAndRefresh).mockRejectedValueOnce(error);
    await expect(handleUiMessage({ type: "ui:applyManualFix", nodeId: "1:2", fix, spellingSource: "suggested" }, gate())).rejects.toThrow("apply failed");
    expect(trackPluginError).toHaveBeenCalledExactlyOnceWith("manual_apply", error);
  });

  it("T-144: передаёт происхождение ошибки сканирования без второго владельца записи", async () => {
    const error = annotateFailure(new Error("private scan failure"), "scan", "scan_failed");
    vi.mocked(applyManualFixAndRefresh).mockRejectedValueOnce(error);
    await expect(handleUiMessage({ type: "ui:applyManualFix", nodeId: "1:2", fix }, gate())).rejects.toBe(error);
    expect(trackPluginError).toHaveBeenCalledExactlyOnceWith("manual_apply", error);
  });
});
