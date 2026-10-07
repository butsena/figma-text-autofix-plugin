import { trackPluginError } from "../analytics/pipeline-events";
import { applyManualFixAndRefresh, skipManualFixAndRefresh } from "./apply-manual-fix";
import { runAutofixPipeline } from "./autofix-pipeline";
import { focusLayerById } from "./focus-layer";
import { clampPluginUiHeight } from "../shared/plugin-ui-layout";
import type { UiToPluginMessage } from "../shared/messages";

export type UiMessageGate = {
  uiReady: boolean;
  runPipelineWhenReady: boolean;
};

export function resizePluginUi(width: number, height: number): void {
  figma.ui.resize(width, clampPluginUiHeight(height));
}

export async function handleUiMessage(
  message: UiToPluginMessage,
  gate: UiMessageGate,
): Promise<void> {
  switch (message.type) {
    case "ui:ready": {
      gate.uiReady = true;
      if (gate.runPipelineWhenReady) {
        gate.runPipelineWhenReady = false;
        await runAutofixPipeline();
      }
      break;
    }
    case "ui:applyManualFix": {
      try {
        await applyManualFixAndRefresh(message.nodeId, message.fix);
      } catch (e) {
        trackPluginError("manual_apply", e);
        throw e;
      }
      break;
    }
    case "ui:skipManualFix": {
      try {
        await skipManualFixAndRefresh(message.nodeId, message.fix);
      } catch (e) {
        trackPluginError("manual_apply", e);
        throw e;
      }
      break;
    }
    case "ui:resize": {
      resizePluginUi(message.width, message.height);
      break;
    }
    case "ui:focusLayer": {
      await focusLayerById(message.nodeId);
      break;
    }
    case "ui:close": {
      figma.closePlugin();
      break;
    }
    default:
      break;
  }
}
